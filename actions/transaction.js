"use server";

//import aj from "@/lib/arcjet";
import { db } from "@/lib/prisma";
import { rateLimiter } from "@/lib/rateLimiting";
//import { request } from "@arcjet/next";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


const serializeAmount=(obj)=>({
    ...obj,
    amount:obj.amount.toNumber()
});


export async function createTransaction(data) {
    try {
        const {userId}=await auth();
        if(!userId) throw new Error("Unauthorized"); //if the user is not authenticated

        //Arcjet to add rate limiting  
        /*const req=await request();
        const decision=await aj.protect(req,{
            userId,
            requested:1,
        });

        if(decision.isDenied()){
            if(decision.reason.isRateLimit()){
                const {remaining,reset}=decision.reason;
                console.error({
                    code:"RATE_LIMIT_EXCEEDED",
                    details:{
                        remaining,
                        resetInSeconds:reset,
                    },
                });
                throw new Error("Too many requests,Please try again later");
            }
            throw new Error("Request Blocked");
        }*/

        //add rate limiting for creating transactions using upstash
        const { success, remaining, reset } = await rateLimiter.limit(userId);
        if (!success) {
            throw new Error(
            `Too many requests,Please try again later. Try again in ${Math.floor((reset - Date.now()) / 1000)} seconds.`
            );
        }


        const user=await db.user.findUnique({
            where:{clerkUserId:userId},
        });

        if(!user){
        throw new Error("user not found");
        }    

        const account=await db.account.findUnique({
            where:{
                id:data.accountId,
                userId:user.id,
            },
        });

        if(!account){
            throw new Error("Account not Found");
        }

        const balanceChange=data.type === "EXPENSE" ? -data.amount : data.amount;
        const newBalance=account.balance.toNumber() + balanceChange;

        //create the transaction and update the account with new balance 
        //2 operations related to each other,if one fails the other must fail also so use the $transaction operation from prisma
        const transaction=await db.$transaction(async(tx)=>{
            const newTransaction=await db.transaction.create({
                data:{
                    //add all the data but override userId and nextRecurringDate
                    ...data,
                    userId:user.id,
                    nextRecurringDate:data.isRecurring && data.recurringInterval ?
                    calculateNextRecurringDate(data.date,data.recurringInterval):null,
                },
            });

            //update the account's balance
            await tx.account.update({
                where:{id:data.accountId},
                data:{balance:newBalance},
            });

            return newTransaction;
        });

        revalidatePath("/dashboard");
        revalidatePath(`/account/${transaction.accountId}`);

        return {success:true,data:serializeAmount(transaction)};
    } catch (error) {
        throw new Error(error.message);
    }
}

//helper function to calculate next recurring date
function calculateNextRecurringDate(startDate,interval){
    //parameters are the date and interval entered by the user during creating the transaction
    const date=new Date(startDate);

    switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
    return date;
}

export async function scanReceipt(file){
    try {

        //initialize the generative model from genAI API
        const model=genAI.getGenerativeModel({model:"gemini-1.5-flash"});

        //reads the contents of the file and converts them to raw data(binary data)
        const arrayBuffer=await file.arrayBuffer();

        //Gemini API expects image input as base64-encoded data
        //converts the binary data into a base64-encoded string which is the text format that gemini can understand 
        const base64String=Buffer.from(arrayBuffer).toString("base64");

        //ISO format:YYYY-MM-DD
        //define the Prompt(tells the model what to extract and the exact JSON format to respond in)
        const prompt = `
            Analyze this receipt image and extract the following information in JSON format:
            - Total amount (just the number)
            - Date (in ISO format) 
            - Description or items purchased (brief summary)
            - Merchant/store name
            - Suggested category (one of: housing,transportation,groceries,utilities,entertainment,food,shopping,healthcare,education,personal,travel,insurance,gifts,bills,other-expense )
            
            Only respond with valid JSON in this exact format:
            {
                "amount": number,
                "date": "ISO date string",
                "description": "string",
                "merchantName": "string",
                "category": "string"
            }

            If its not a receipt, return an empty object
        `;

        //calling the model and asking it to generate a response,i give it a list of inputs(image data and the prompt)  
        //result will contain the AI's response(JSON format)
        const result=await model.generateContent([
            {
                inlineData:{
                    data:base64String,
                    mimeType:file.type,//without this,the model won't know how to process the content
                },
            },
            prompt,
        ]);

        const response=await result.response;//gets the response object from the gemini model
        const text=response.text();//extract the text content from the response

        //prepares the text to safely convert it into JSON
        const cleanedText=text.replace(/```(?:json)?\n?/g, "").trim();

        try {
            const data=JSON.parse(cleanedText);//converts JSON text to a js object to access its properties
            return{
                amount:parseFloat(data.amount),//to a float which may be a string
                date:new Date(data.date),//to a js date object
                description:data.description,
                category:data.category,
                merchantName:data.merchantName,
            };
        } catch (error) { //if JSON.parse() fails
            console.error("Error parsing JSON response:",error);
            throw new Error("Invalid response format from Gemini");
        }
    } catch (error) {//if the scanning fails
        console.error("Error scanning receipt:",error.message);
        throw new Error("Failed to scan receipt");
    }
}

export async function getTransaction(id){
    const {userId}=await auth();
    if(!userId) throw new Error("Unauthorized");
    
    const user=await db.user.findUnique({
            where:{clerkUserId:userId},
    });

    if(!user){
    throw new Error("user not found");
    }    

    //fetch the transaction to edit it
    const transaction=await db.transaction.findUnique({
        where:{
            id,
            userId:user.id,
        },
    });

    if(!transaction) throw new Error("Transaction not found");

    return serializeAmount(transaction);
}


export async function updateTransaction(id,data){
    try{
        const {userId}=await auth();
        if(!userId) throw new Error("Unauthorized");
        
        const user=await db.user.findUnique({
                where:{clerkUserId:userId},
        });

        if(!user){
        throw new Error("user not found");
        }
        
        //get original transaction to calculate balance change
        const originalTransaction=await db.transaction.findUnique({
            where:{
                id,
                userId:user.id,
            },
            include:{
                account:true,
            },
        });

        if(!originalTransaction) throw new Error("Transaction not found");

        //calculate balance changes
        const oldBalanceChange=
           originalTransaction.type === "EXPENSE"
           ? -originalTransaction.amount.toNumber() //amount of transaction
           : originalTransaction.amount.toNumber();

        const newBalanceChange=
           data.type==="EXPENSE" ? -data.amount : data.amount;

        //value added to the account balance 
        const netBalanceChange=newBalanceChange - oldBalanceChange;

        //update transaction and account balance in a transaction
        const transaction=await db.$transaction(async(tx)=>{
            const updated=await tx.transaction.update({
                where:{
                    id,
                    userId:user.id,
                },
                data:{
                    ...data,
                    nextRecurringDate:
                       data.isRecurring && data.recurringInterval
                         ?calculateNextRecurringDate(data.date,data.recurringInterval)
                         :null,
                },
            });

            //update account balance
            await tx.account.update({
                where:{id:data.accountId},
                data:{
                    balance:{
                        increment:netBalanceChange,
                    },
                },
            });

            return updated;
        });

        revalidatePath("/dashboard");
        revalidatePath(`/account/${data.accountId}`);

        return {success:true,data:serializeAmount(transaction)};
    }
    catch(error){
        throw new Error(error.message);
    }
}
