import { sendEmail } from "@/actions/send-email";
import { db } from "../prisma";
import { inngest } from "./client";
import EmailTemplate from "@/emails/template";
import { GoogleGenerativeAI } from "@google/generative-ai";

//Sending Budget Alerts Email
export const checkBudgetAlert = inngest.createFunction(
  { name: "Check Budget Alerts" },
  { cron: "0 */6 * * *" }, //cron job that runs every 6 hours
  async ({ step }) => {
    //1st step that waits to fetch data from db and stores the result in budgets
    const budgets = await step.run("fetch-budgets", async () => {
      return await db.budget.findMany({
        //find the default accounts for all users to take their budget later
        include: {
          user: {//For each budget,we're including its associated user.
            include: {
              accounts: {//For each user,we're including their accounts(but only the default one)
                where: {
                  isDefault: true,
                },
              },
            },
          },
        },
      });
    });


    //loop over budgets:object of default accounts records 
    for (const budget of budgets) {
      const defaultAccount = budget.user.accounts[0];//get the first default account(typically the only one)
      if (!defaultAccount) continue; // Skip this budget if no default account and moves to the next one

      //2nd step to find the percentUsed
      await step.run(`check-budget-${budget.id}`, async () => {

        const currentDate=new Date();//current date and time
        const startOfMonth=new Date(currentDate.getFullYear(),currentDate.getMonth(),1);//first day of the month
        const endOfMonth=new Date(currentDate.getFullYear(),currentDate.getMonth()+1,0);//0th day of next month = last day of current month

        // Calculate total expenses for the default account only
        const expenses = await db.transaction.aggregate({
          where: {
            userId: budget.userId,
            accountId: defaultAccount.id,
            type: "EXPENSE",
            date: {
              gte:startOfMonth,
              lte:endOfMonth,
            },
          },
          _sum: {
            amount: true,
          },
        });

        const totalExpenses = expenses._sum.amount?.toNumber() || 0;
        const budgetAmount = budget.amount;
        const percentageUsed = (totalExpenses / budgetAmount) * 100;

        // Check if we should send an alert
        if (
          percentageUsed >= 80 && 
          (!budget.lastAlertSent ||
            isNewMonth(new Date(budget.lastAlertSent), new Date()))
        ) {
          //Send Email
          //waits until the sendEmail() finishes then it continues the execution (go to update last alert sent)
          await sendEmail({
            to: budget.user.email,
            subject: `Budget Alert for ${defaultAccount.name}`,
            react: EmailTemplate({
              userName: budget.user.name,
              type: "budget-alert",
              data: {
                percentageUsed,
                budgetAmount: parseInt(budgetAmount).toFixed(1),
                totalExpenses: parseInt(totalExpenses).toFixed(1),
                accountName: defaultAccount.name,
              },
            }),
          });


          // Update last alert sent
          await db.budget.update({
            where: { id: budget.id },
            data: { lastAlertSent: new Date() },
          });
        }
      });
    }
  }
);

function isNewMonth(lastAlertDate, currentDate) {
  return (
    lastAlertDate.getMonth() !== currentDate.getMonth() ||
    lastAlertDate.getFullYear() !== currentDate.getFullYear()
  );
}

//add the recurring transactions every next date automatically to our transactions
export const triggerRecurringTransactions=inngest.createFunction({
    id:"trigger-recurring-transactions",
    name:"Trigger Recurring Transactions",
  },{cron:"0 0 * * *"},//the job will run everyday at midnight
  async({step})=>{
    //fetch all due recurring transactions
    const recurringTransactions=await step.run(
      "fetch-recurring-transactions",
      async()=>{
        return await db.transaction.findMany({
          where:{
            isRecurring:true,
            status:"COMPLETED",
            OR:[
              {lastProcessed:null},//never processed
              {nextRecurringDate:{lte:new Date()}},//due date passed
            ],
          },
        });
      }
    );

    //create events for each transaction
    //goes through each transaction and builds a new object with a name and data  
    if(recurringTransactions.length > 0){
      const events=recurringTransactions.map((transaction)=>({
        name:"transaction.recurring.process",
        data:{transactionId:transaction.id,userId:transaction.userId},
      }));

      //send events to inngest to be processed
      await inngest.send(events);
    }

    //This returns an object that indicates how many recurring transactions were processed by function
    return {triggered:recurringTransactions.length};
  }
);

//event batching:sending multiple events together in one call
export const processRecurringTransaction =inngest.createFunction({
    id:"process-recurring-transaction",
    throttle:{ //a specific user can only trigger this function up to a certain nb of times(limit nb of operations) within a given time period
      limit:10,//only process 10 transactions
      period:"1m",//per minute
      key:"event.data.userId",//per user
    },
  },
  {event:"transaction.recurring.process"},
  async({event,step})=>{
    //validate event data
    if(!event?.data?.transactionId || !event?.data?.userId){
      console.error("Invalid event data:",event);
      return{error:"Missing required event data"};
    }

    await step.run("process-transaction",async()=>{
      const transaction=await db.transaction.findUnique({
        where:{
          id:event.data.transactionId,
          userId:event.data.userId,
        },
        include:{
          account:true,
        },
      });

      if(!transaction || !isTransactionDue(transaction)) return;//exit the step.run function

      await db.$transaction(async(tx)=>{
        //create new transaction
        await tx.transaction.create({
          data:{
            type:transaction.type,
            amount:transaction.amount,
            description:`${transaction.description} (Recurring)`,
            date:new Date(),
            category:transaction.category,
            userId:transaction.userId,
            accountId:transaction.accountId,
            isRecurring:false,
          },
        });

        //update account balance
        const balanceChange=
           transaction.type === "EXPENSE"
           ? -transaction.amount.toNumber() 
           :  transaction.amount.toNumber();

        await tx.account.update({
          where:{id:transaction.accountId},
          data:{balance:{increment:balanceChange}},
        });

        //update last processed date and next recurring date
        await tx.transaction.update({
          where:{id:transaction.id},
          data:{
            lastProcessed:new Date(),
            nextRecurringDate:calculateNextRecurringDate(
              new Date(),transaction.recurringInterval),
          },
        });
      });
    });
  }
);


function isTransactionDue(transaction){
  //if no lastProcessed date, transaction is due
  if(!transaction.lastProcessed) return true;

  const today=new Date();
  const nextDue=new Date(transaction.nextRecurringDate);

  return nextDue <= today;
}

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



//monthly reports
export const generateMonthlyReports=inngest.createFunction({
  id:"generate-monthly-reports",
  name:"Generate Monthly Reports",
},
{cron:"0 0 1 * *"},//cron job that run at the end of every month
async({step})=>{
  const users=await step.run("fetch-users",async()=>{
    return await db.user.findMany({//fetch all the users
      include:{accounts:true}
    });
  });


  for(const user of users){
    await step.run(`generate-report-${user.id}`,async()=>{
      const lastMonth=new Date();
      lastMonth.setMonth(lastMonth.getMonth()-1);

      const stats=await getMonthlyStats(user.id,lastMonth);
      const monthName=lastMonth.toLocaleString("default",{
        month:"long" //returns the full name of the month
      });

      // Generate AI insights
      const insights = await generateFinancialInsights(stats, monthName);

      await sendEmail({
        to: user.email,
        subject: `Your Monthly Financial Report - ${monthName}`,
        react: EmailTemplate({
          userName: user.name,
          type: "monthly-report",
          data: {
            stats,
            month: monthName,
            insights,
          },
        }),
      });
    });
  }
    
  return { processed: users.length };
  }
);


//generate monthly reports
async function generateFinancialInsights(stats,month){
  const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model=genAI.getGenerativeModel({model:"gemini-1.5-flash"});

  const prompt = `
    Analyze this financial data and provide 3 concise, actionable insights.
    Focus on spending patterns and practical advice.
    Keep it friendly and conversational.

    Financial Data for ${month}: 
    - Total Income: $${stats.totalIncome}
    - Total Expenses: $${stats.totalExpenses}
    - Net Income: $${stats.totalIncome - stats.totalExpenses}
    - Expense Categories: ${Object.entries(stats.byCategory)
      .map(([category, amount]) => `${category}: $${amount}`)
      .join(", ")}

    Format the response as a JSON array of strings, like this:
    ["insight 1", "insight 2", "insight 3"]
  `;

  try { //get the response
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      "Your highest expense category this month might need attention.",
      "Consider setting up a budget for better financial management.",
      "Track your recurring expenses to identify potential savings.",
    ];
  }
}

const getMonthlyStats=async(userId,month)=>{
  const startDate=new Date(month.getFullYear(),month.getMonth(),1);
  const endDate=new Date(month.getFullYear(),month.getMonth()+1,0);

  const transactions=await db.transaction.findMany({
    where:{
      userId,
      date:{
        gte:startDate,
        lte:endDate,
      },
    },
  });
  
  return transactions.reduce( 
    (stats, t) => { //stats is accumulator and t is 1 transaction
      const amount = t.amount.toNumber();
      if (t.type === "EXPENSE") {
        stats.totalExpenses += amount;
        stats.byCategory[t.category] =
          (stats.byCategory[t.category] || 0) + amount;
      } else {
        stats.totalIncome += amount;
      }
      return stats;
    },
    {//properties of the object returned by getMonthlyStats
      totalExpenses: 0,
      totalIncome: 0,
      byCategory: {},//objects of categories
      transactionCount: transactions.length,
    }
  );
}