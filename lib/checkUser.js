import { currentUser } from "@clerk/nextjs/server"
import { db } from "./prisma";

export const checkUser = async() => {
    const user=await currentUser(); //Waits for the current user info and stores it in user

    if(!user){  //if the user is not logged in
        return null;
    }

    //check if the user is in our db
    try {
        const loggedInUser=await db.user.findUnique({
            where:{
                clerkUserId:user.id,
            },
        });

        if(loggedInUser){ //an user already exists in db
            return loggedInUser;
        }

        //if a new user logged in and its not in the db we will add it
        const name=`${user.firstName} ${user.lastName}`;
        const newUser=await db.user.create({
            data:{
                clerkUserId:user.id,
                name,
                imageUrl:user.imageUrl,
                email:user.emailAddresses[0].emailAddress,
            },
        });
        return newUser;
    } catch (error) {
        console.log(error.message);
    }
};