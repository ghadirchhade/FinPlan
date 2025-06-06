"use client";

import { Card, CardContent,CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { endOfDay, format, startOfDay, subDays } from 'date-fns';
import React, { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';


const DATE_RANGES={
    "7D":{label:"Last 7 Days",days:7}, //show transactions from 7 days to today
    "1M":{label:"Last Month",days:30},
    "3M":{label:"Last 3 Months",days:90},
    "6M":{label:"Last 6 Months",days:180},
    ALL:{label:"All Time",days:null},
}


const AccountChart = ({transactions}) => {
    const [dateRange,setDateRange]=useState("1M");

    const filteredData=useMemo(()=>{
        const range=DATE_RANGES[dateRange];
        const now=new Date();//get the current date and time
        const startDate=range.days
          ? startOfDay(subDays(now,range.days)) //subtracts range.days from now and resets the time to midnight 00:00:00 using startOfDay
          :startOfDay(new Date(0));//Unix epoch (January 1, 1970)==>for All Time(no range.days)

        //filter transactions within date range (that we want to show in a date range)
        const filtered=transactions.filter(
            (t)=> new Date(t.date) >= startDate && new Date(t.date) <= endOfDay(now) //endOfDay(now)==>date and time =23:59:59.999 for the current date
        );

        const grouped=filtered.reduce((acc,transaction)=>{
            const date=format(new Date(transaction.date),"MMM dd");

            if(!acc[date]){
                acc[date]={date,income:0,expense:0};
            }

            if(transaction.type === "INCOME"){
                acc[date].income += transaction.amount;
            }
            else{
                acc[date].expense += transaction.amount;
            }

            return acc;//object of keys(date) and values(date,income,expense)
        },{});

        //extract values from grouped and store them in an array then sort by date
        //return to filteredData
        return Object.values(grouped).sort(
            (a,b) => new Date(a.date) - new Date(b.date)
        );
    },[transactions,dateRange]);

    //Calculate total income and expense from daily records
    //returns an object that contains the total expense and the total income 
    const totals=useMemo(()=>{
        return filteredData.reduce((acc,day)=>({
            income:acc.income + day.income, //initially:0+income of the first transaction then acc.income becomes=income of the first transaction and adds to it and so on
            expense:acc.expense + day.expense,
        }),{income:0,expense:0});//acc.income and acc.expense initially
    },[filteredData])


  return (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
            <CardTitle className="text-base font-normal">
                Transactions Overview
            </CardTitle>
            <Select defaultValue={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Select Range"/>
                </SelectTrigger>
                <SelectContent>
                   {/*Object.entries() convert an object to an array of keys and values*/}
                   {Object.entries(DATE_RANGES).map(([key,{label}])=>{
                    return(
                        <SelectItem key={key} value={key}>
                            {label}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
            </Select>
        </CardHeader>
        <CardContent>
            <div className="flex justify-around mb-6 text-sm">
                <div className="text-center">
                    <p className="text-muted-foreground">Total Incomes</p>
                    <p className="text-lg font-bold text-green-500">
                        ${totals.income.toFixed(2)}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-muted-foreground">Total Expenses</p>
                    <p className="text-lg font-bold text-red-500">
                        ${totals.expense.toFixed(2)}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-muted-foreground">Net</p>
                    <p 
                      className={`text-lg font-bold ${
                        totals.income - totals.expense >=0 
                        ? "text-green-500" //profit
                        : "text-red-500"   //loss
                      }`}>
                        ${(totals.income - totals.expense).toFixed(2)}
                    </p>
                </div>
            </div>
            <div className="h-[300px]"> 
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={filteredData} //contains income,expense,date 
                      margin={{
                        top:10,
                        right:10,
                        left:10,
                        bottom:0,
                      }}
                    >
                        {/*Adds grid lines to the chart's background,3px dash then 3px gap,disable vertical grids*/}
                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                            <XAxis dataKey="date"/>
                            <YAxis 
                               fontSize={12}
                               tickLine={false}
                               axisLine={false}
                               tickFormatter={(value) => `$${value}`} //format of the y axis labels
                            />
                            <Tooltip formatter={(value) => [`$${value}`, undefined]}/>
                            <Legend/>
                            <Bar 
                              dataKey="income"
                              name="income"
                              fill="#22c55e"
                              radius={[4,4,0,0]} 
                             />
                             <Bar 
                              dataKey="expense"
                              name="expense"
                              fill="#ef4444"
                              radius={[4,4,0,0]} //bar border-radius
                             />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </CardContent>
    </Card>    
  );
}
export default AccountChart;
