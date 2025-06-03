import { RecurringInterval } from "@/lib/generated/prisma";
import { string, z } from "zod";

//when we click submit button,the validation occurs
export const accountSchema=z.object({
    name:z.string().min(1,"Name is required"),
    type:z.enum(["CURRENT","SAVINGS"]),
    balance:z.string().min(1,"Initial balance is required"),
    isDefault:z.boolean().default(false),
});

export const transactionSchema = z.object({
    type:z.enum(["INCOME","EXPENSE"]),
    amount:z.string().min(1,"Amount is Required"),
    description:z.string().optional(),
    date:z.date({required_error:"Date is Required"}),
    accountId:z.string().min(1,"Account is Required"),
    category:z.string().min(1,"Category is Required"),
    isRecurring:z.boolean().default(false),
    recurringInterval:z.enum(["DAILY","WEEKLY","MONTHLY","YEARLY"]).optional(),
}).superRefine((data,ctx)=>{
    if(data.isRecurring && !data.recurringInterval){
        ctx.addIssue({
            code:z.ZodIssueCode.custom,
            message:"Recurring interval is required for recurring transactions",
            path:["recurringInterval"],
        });
    }
});