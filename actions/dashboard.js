"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

//serialization=convert object into a format that can be saved, sent, or stored like JSON or a string
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

export async function createAccount(data) {
    try {
        const {userId}=await auth();
        if(!userId) throw new Error("Unauthorized");//if the user is not authenticated

        const user=await db.user.findUnique({
            where:{clerkUserId:userId},
        });

        if(!user){
            throw new Error("user not found")
        }

        const balanceFloat=parseFloat(data.balance);
        if(isNaN(balanceFloat)){
            throw new Error("Invalid balance amount");
        }

        //check if this is the user's first account
        const existingAccount=await db.account.findMany({
            where:{userId:user.id},
        });

        const shouldBeDefault=existingAccount.length === 0 ? true : data.isDefault;

        //if this account(created acc) should be default,so unset all other default accounts
        if(shouldBeDefault){
            await db.account.updateMany({
                where:{userId:user.id,isDefault:true},
                data:{isDefault:false},
            });
        }

        //creating an account
        const account=await db.account.create({
            data:{
                ...data,
                balance:balanceFloat,
                userId:user.id,
                isDefault:shouldBeDefault,
            },
        });

        //Because Decimal aren’t serializable so we convert it to a serializable format using .toNumber()
        const serializedAccount=serializeTransaction(account);

        //create a new account , and i want the user’s dashboard to show the updated list immediately
        revalidatePath("/dashboard");
        return{success:true,data:serializedAccount};

    } catch (error) {
        throw new Error(error.message);
    }
}


export async function getUserAccounts(){
    const {userId}=await auth();
    if(!userId) throw new Error("Unauthorized");//if the user is not authenticated

    const user=await db.user.findUnique({
        where:{clerkUserId:userId},
    });

    if(!user){
        throw new Error("user not found")
    }

    const accounts=await db.account.findMany({
        where:{userId:user.id},
        orderBy:{createdAt:"desc"}, //latest accounts first
        include:{//For each account, include a count of how many transactions are related to it
            _count:{
                select:{
                    transactions:true,
                },
            },
        },
    });

    const serializedAccount=accounts.map(serializeTransaction);
    return serializedAccount;
}

export async function getDashboardData(){
    const {userId}=await auth();
    if(!userId) throw new Error("Unauthorized");//if the user is not authenticated

    const user=await db.user.findUnique({
        where:{clerkUserId:userId},
    });

    if(!user){
        throw new Error("user not found")
    }

    //get all user transactions
    const transactions=await db.transaction.findMany({
        where:{userId:user.id},
        orderBy:{date:"desc"},
    });

    return transactions.map(serializeTransaction);
}