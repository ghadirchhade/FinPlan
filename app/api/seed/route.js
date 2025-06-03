//creating an api in next.js,access it : localhost:3000/api/seed

import { seedTransactions } from "@/actions/seed";

export async function GET() {
    const result=await seedTransactions();
    return Response.json(result);
}