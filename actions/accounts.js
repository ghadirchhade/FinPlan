"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

const serializeTransaction=(obj)=>{
    const serialized={...obj};// create a copy of the input object.
    if(obj.balance){
        serialized.balance=obj.balance.toNumber();//safe to serialize and let the whole object as it ,only it updates the balance
    }

    if(obj.amount){
        serialized.amount=obj.amount.toNumber();
    }

    return serialized;
};


export async function updateDefaultAccount(accountId){ //accountId=id of the account that i want to put it as default one
    try {
       const {userId}=await auth();
       if(!userId) throw new Error("Unauthorized");//if the user is not authenticated

        const user=await db.user.findUnique({
           where:{clerkUserId:userId},
        });

        if(!user){
          throw new Error("user not found")
        }

        //set any default account of this user to nondefault  
        await db.account.updateMany({
            where:{userId:user.id,isDefault:true},
            data:{isDefault:false},
        });

        //set the parameter account as default
        const account=await db.account.update({
            where:{
                id:accountId,
                userId:user.id,
            },
            data:{isDefault:true},
        });

        revalidatePath("/dashboard");
        return {success:true,data:serializeTransaction(account)};
    } catch (error) {
        return{success:false,error:error.message};
    }
}


export async function getAccountWithTransactions(accountId){
    const {userId}=await auth();
    if(!userId) throw new Error("Unauthorized");//if the user is not authenticated

     const user=await db.user.findUnique({
        where:{clerkUserId:userId},
     });

     if(!user){
       throw new Error("user not found")
     }
    
     //find one unique account including its related transactions ordered by the date (latest first) and a count of transactions for that account
     const account=await db.account.findUnique({
        where:{id:accountId,userId:user.id},
        include:{
            transactions:{
                orderBy:{date:"desc"},
            },
            _count:{
                select:{transactions:true},
            },
        },
     });

     if(!account) return null;

     return{
        ...serializeTransaction(account),
        //applies the serialization function to each transaction of the account and return the result in transactions array
        transactions:account.transactions.map(serializeTransaction),
     };
}

export async function bulkDeleteTransactions(transactionIds){
    try{
        const {userId}=await auth();
        if(!userId) throw new Error("Unauthorized");//if the user is not authenticated

        const user=await db.user.findUnique({
            where:{clerkUserId:userId},
        });

        if(!user){
        throw new Error("user not found")
        }

        const transactions=await db.transaction.findMany({
            where:{
                id:{in:transactionIds},
                userId:user.id,
            },
        });

        //When transactions are deleted, the corresponding account balances must be adjusted
        const accountBalanceChanges=transactions.reduce((acc,transaction)=>{
            const change=
               transaction.type === "EXPENSE"
               ? transaction.amount
               : -transaction.amount;

            acc[transaction.accountId]= (acc[transaction.accountId] || 0)+ change;
            return acc;
        },{}); 
  

        //$transaction is a Prisma method where all queries inside this function will use the same database transaction, so if any of them fail(db error ,invalid accountId ...), all are rolled back
        //uses when we want to do several api call in the same transaction 
        //here we want to delete transactions from the db and directly updates the balances 
        await db.$transaction(async (tx)=>{
            //delete transactions
            await tx.transaction.deleteMany({
                where:{
                    id:{in : transactionIds},
                    userId:user.id,
                },
            });

            //accountBalanceChanges has keys (accountId) and values balanceChange(how much to change the balance + or - values)
            //loops on the account table and update the balance 
            for (const [accountId,balanceChange] of Object.entries(accountBalanceChanges)){
                await tx.account.update({
                    where:{id:accountId},
                    data:{
                        balance:{
                            increment:balanceChange, //decrease or increase the balance by balanceChange value
                        },
                    },
                });
            }
         });

         revalidatePath("/dashboard");
         revalidatePath("/account/[id]");
         return {success:true};
    }
    catch(error){
        return {success:false,error:error.message};
    }
}

 