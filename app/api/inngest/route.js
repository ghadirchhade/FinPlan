import { inngest } from "@/lib/inngest/client";
import { checkBudgetAlert, generateMonthlyReports } from "@/lib/inngest/functions";
import { serve } from "inngest/next";

// Create an API to serves bg functions
//Trigger those jobs(events) when events happen
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    checkBudgetAlert,
    generateMonthlyReports,
  ],
});