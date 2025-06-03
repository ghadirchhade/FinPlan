"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getCurrentBudget(accountId){
    try {
        const {userId}=await auth();
        if(!userId) throw new Error("Unauthorized"); //if the user is not authenticated

        const user=await db.user.findUnique({
            where:{clerkUserId:userId},
        });

        if(!user){
        throw new Error("user not found");
        }    

        //only the first matching bcz we work in one-to-one relationship between the user and the budget
        const budget=await db.budget.findFirst({ 
            where:{
                userId:user.id,
            },
        });

        const currentDate=new Date();
        const startOfMonth=new Date(currentDate.getFullYear(),currentDate.getMonth(),1);
        const endOfMonth=new Date(currentDate.getFullYear(),currentDate.getMonth()+1,0);//0th day of next month = last day of current month

        const expenses= await db.transaction.aggregate({
            where:{
                userId:user.id,
                type:"EXPENSE",
                date:{
                    gte:startOfMonth,
                    lte:endOfMonth,
                },
                accountId,//parameter accountId
            },
            _sum:{
                amount:true,
            },
        });
        return{
            //returns an object that holds the sum of expenses amount and the current budget if exists
            //copies all properties of the budget object and overwrites the amount field(from decimal to a js number)
            budget:budget ? {...budget,amount:budget.amount.toNumber()} : null,
            currentExpenses:expenses._sum.amount ? expenses._sum.amount.toNumber() : 0,
        };
    } 
    catch (error) {
        console.error("Error fetching budget:",error);
        throw error;
    }
}

export async function updateBudget(amount){
    try {
        const {userId}=await auth();
        if(!userId) throw new Error("Unauthorized"); //if the user is not authenticated

        const user=await db.user.findUnique({
            where:{clerkUserId:userId},
        });

        if(!user){
        throw new Error("user not found");
        }   
        
        //if the record exists where userId===user.id it runs the update clause , if no record exists it runs the create clause (1 atomic db call)
        const budget=await db.budget.upsert({
            where:{
                userId:user.id,//must be primary key 
            },
            update:{
                amount,
            },
            create:{
                userId:user.id,
                amount,
            },
         });


        revalidatePath("/dashboard");
        return{
            success:true,
            data:{...budget,amount:budget.amount.toNumber()},
        }
    } catch (error) {
        console.log("Error updating budget:",error);
        return {success:false,error:error.message};
    }
}