//useFetch custom hook is a reusable utility for handling asynchronous data fetching in a React component. 
//It simplifies the common pattern of calling a function (API call), managing loading state, handling errors, and storing the result.

import { toast } from "sonner";

const { useState } = require("react");

//cb-->endPoint:resource we are trying to fetch it(parameter of useFetch)
const useFetch=(cb)=>{
    const[data,setData]=useState(undefined);
    const[loading,setLoading]=useState(null);
    const[error,setError]=useState(null);
  
    //fn accepts any number of arguments
    const fn=async(...args)=>{
        setLoading(true);
        setError(null);

        try {
            const response=await cb(...args);
            setData(response);
            setError(null);
        } catch (error){
            setError(error);
            toast.error(error.message);
        }finally{
            setLoading(false);
        }
    };
    return {data,loading,error,fn,setData};
}
export default useFetch;