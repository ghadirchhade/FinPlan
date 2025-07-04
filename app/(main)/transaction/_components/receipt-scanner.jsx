"use client";

import { scanReceipt } from '@/actions/transaction';
import { Button } from '@/components/ui/button';
import useFetch from '@/hooks/use-fetch';
import { Camera, Loader2 } from 'lucide-react';
import React, { useEffect, useRef } from 'react'
import { toast } from 'sonner';

const ReceiptScanner = ({onScanComplete}) => {
    const fileInputRef=useRef(null);

    const {
        loading:scanReceiptLoading,
        fn:scanReceiptFn,
        data:scannedData,//data extracted from the file (js object)
    }=useFetch(scanReceipt);

    const handleReceiptScan=async(file)=>{
        if(file.size > 5*1024*1024){
            toast.error("File size should be less than 5MB");
            return;
        }
        await scanReceiptFn(file);
    };

    useEffect(()=>{
        if(scannedData && !scanReceiptLoading){
            onScanComplete(scannedData);
            toast.success("Receipt scanned successfully");
        }
    },[scanReceiptLoading,scannedData]);

  return (
    <div className="flex items-center gap-4"> 
        <input 
            type="file" 
            ref={fileInputRef}
            className="hidden"
            accept="image/*" //only allows the user to pick images like jpg,png,etc.
            capture="environment" //tells mobile browsers to use the back camera for scanning receipts directly
            onChange={(e)=>{
                const file=e.target.files?.[0]; //gets the first selected file
                if (file) handleReceiptScan(file); //If a file exists, send it to  handleReceiptScan function
            }}
        />
        <Button 
           type="button"
           variant="outline"
           className="w-full h-10 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500
              animate-gradient hover:opacity-90 transition-opacity text-white hover:text-white"
            onClick={()=>fileInputRef.current?.click()} // When the user clicks the button, the file input opens 
            disabled={scanReceiptLoading}
        >
            {scanReceiptLoading?(
                <>
                  <Loader2 className="mr-2 animate-spin"/>
                  <span>Scanning Receipt...</span>

                </>
            ) : (
                <>
                <Camera className="mr-2"/>
                <span>Scan Receipt with AI</span>
                </>
            )}
        </Button>
    </div>
  );
}

export default ReceiptScanner;
