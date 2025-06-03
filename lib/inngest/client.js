import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ 
    id: "finPlan",
    name: "FinPlan",
    retryFunction: async(attempt)=>({
        delay:Math.pow(2,attempt)*1000,
        maxAttempts:2,
    }),
});


//retryFunction is for:When a background job (like sending an email) fails, Inngest can retry it
//The retryFunction lets you control:How long to wait between retries and How many times to retry
//attempt:retry number
//delay:it waits longer after each failed attempt
//1st retry waits 2^1*1000(2sec) after the first failure
//2nd retry waits 4 sec after the second retry
//maxAttempts:2=>If the job still fails after 2 tries, Inngest stops retrying