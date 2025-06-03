"use client";
import React, { useEffect, useState } from 'react'
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from './ui/drawer';
import { useForm } from 'react-hook-form';
import {zodResolver} from "@hookform/resolvers/zod";
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { accountSchema } from '@/app/lib/schema';
import useFetch from '@/hooks/use-fetch';
import { createAccount } from '@/actions/dashboard';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CreateAccountDrawer = ({children}) => {
  //{children} is the children of the CreateAccountDrawer component
  const[open,setOpen]=useState(false); //initially closed
  const singleChild = React.Children.only(children);

  const{register,handleSubmit,formState:{errors},setValue,watch,reset}=useForm({
    resolver:zodResolver(accountSchema),
    defaultValues:{
      name:"",
      type:"CURRENT",
      balance:"",
      isDefault:false,
    },
  });


  //:only naming
  const {data:newAccount,
         error,
         fn:createAccountFn, 
         loading:createAccountLoading
        }=useFetch(createAccount);


  useEffect(()=>{
    //if newAccount(returned data) has value and not in a loading state
    if(newAccount && !createAccountLoading){
      toast.success("Account created successfully");
      reset();//reset the form
      setOpen(false);//close the drawer
    }
  },[createAccountLoading,newAccount])


  //runs when the error change(has value)
  useEffect(()=>{
    if(error){
      toast.error(error.message || "Failed to create an account");
    }
  },[error])

  //data is an object with all the form values.
  const onSubmit = async (data) => {
    await createAccountFn(data);
  }
  /*when we click submit:data is passed into createAccountFn(data):a function returned by useFetch
  so calling createAccountFn(data) actually runs useFetch(createAccount) then runs createAccount(data) 
  inside a try/catch block then set the response into data and returns it (newData)
  cb(...args)-->createAccount(data)
  */ 

  {/*DrawerTrigger:What the user clicks to open the drawer*/}
  return (
    <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{singleChild}</DrawerTrigger> 
        <DrawerContent>
            <DrawerHeader>
                <DrawerTitle>Create New Account</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
                <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Account Name</label>
                    <Input
                      id="name"
                      placeholder="e.g., Ghadir Chhade"
                      {...register("name")}
                      />
                      {errors.name &&(
                        <p className="text-sm text-red-500">{errors.name.message}</p>
                      )}
                    </div> 

                    <div className="space-y-2">
                      <label htmlFor="type" className="text-sm font-medium">Account Type</label>
                      <Select
                        onValueChange={(value)=>setValue("type",value)} //when the selected value is changed,set the type(value of the selected item)to the new selected one
                        defaultValue={watch("type")}
                      >
                        <SelectTrigger id="type" className="w-full">
                          <SelectValue placeholder="Select Type"/>
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="CURRENT">Current</SelectItem>
                           <SelectItem value="SAVINGS">Savings</SelectItem>
                        </SelectContent>
                      </Select>
                        {errors.type &&(
                          <p className="text-sm text-red-500">{errors.type.message}</p>
                        )} 
                    </div> 

                    <div className="space-y-2">
                      <label htmlFor="balance" className="text-sm font-medium">Initial Balance</label>
                      <Input
                        id="balance"
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                        {...register("balance")}
                        />
                        {errors.balance &&(
                          <p className="text-sm text-red-500">{errors.balance.message}</p>
                        )} 
                    </div> 

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <label htmlFor="isDefault" className="text-sm font-medium cursor-pointer">Set as Default</label>
                        <p className="text-sm text-muted-foreground">
                          This will be selected by default for transactions
                        </p>           
                      </div>   
                      <Switch 
                         id="isDefault"
                         onCheckedChange={(checked)=>setValue("isDefault",checked)} //when we toggle the switch it updates the value of isDefault
                         checked={watch("isDefault")}
                      />
                    </div> 

                    {/*to close the drawer*/}
                    <div className="flex gap-4 pt-4">
                      <DrawerClose asChild> 
                        <Button type="button" variant="outline" className="flex-1">Cancel</Button>
                      </DrawerClose>
                      <Button type="submit" className="flex-1" disabled={createAccountLoading}>
                        {createAccountLoading? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                            Creating...
                          </>
                        ):(
                          "Create Account"
                        )}
                      </Button>
                    </div>
                </form>
            </div>
        </DrawerContent>
    </Drawer>
  );
}

export default CreateAccountDrawer;
