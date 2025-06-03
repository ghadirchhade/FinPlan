const { PrismaClient } = require('./generated/prisma')

//Every time you change a file, the dev server reloads the app.
//Without this code, it would create a new Prisma client each time, which can crash your app because of too many open database connections.
export const db=globalThis.prisma || new PrismaClient();

if(process.env.NODE_ENV !== "production"){
    globalThis.prisma=db;
}