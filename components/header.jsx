import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import React from "react";
import { Button } from "./ui/button";
import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, PenBox } from "lucide-react";
import { checkUser } from "@/lib/checkUser";


const Header =async () => {
  await checkUser();
  return (
    <div className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/">
           <Image
            src={"/finPlanLogo.png"} alt="FinPLan logo" height={100} width={300}
            className="h-12 w-50 object-contain"
            priority
           />
        </Link>
      
        <div className="flex items-center space-x-4">
          <SignedIn>
            <Link href={"/dashboard"} prefetch={true}
                  className="text-gray-600 hover:text-blue-600 flex items-center gap-2">
              <Button variant="outline">
                <LayoutDashboard size={18}/>
                <span className="hidden md:inline">Dashboard</span>
              </Button>
            </Link>

            <Link href={"/transaction/create"} prefetch={true}>
              <Button className="flex items-center gap-2">
                <PenBox size={18}/>
                <span className="hidden md:inline">Add Transaction</span>
              </Button>
            </Link>
          </SignedIn> 
          <SignedOut> {/*if the user is signed out we need to show the sign in button*/}
              <SignInButton forceRedirectUrl="/dashboard">
                <Button variant="outline">Login</Button>
              </SignInButton>
          </SignedOut>
          <SignedIn>
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox:"w-10 h-10",
                  },
                }}
              />
          </SignedIn>
        </div>
      </nav>
    </div>
  );
}

export default Header;