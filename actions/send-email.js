//import { v4 as uuidv4 } from "uuid";
"use server";

import { Resend } from "resend";

//it takes time so we need to wait for it to finish(await)
export  async function sendEmail({to,subject,react}){
    const resend = new Resend(process.env.RESEND_API_KEY || "");

    try {
        
        //api call
        //waits for Resend API to receive my email request and waits for Resend API to respond with success or error
        const data=await resend.emails.send(
            {
            from: "Finance App <onboarding@resend.dev>", //from this email bcz it's for free
            to,
            subject,
            react,//email template
            },  
        );
        return {success:true,data};
    } catch (error) {
        console.error("Failed to send email:",error);
        return{success:false,error};
    }
}
