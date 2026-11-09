import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../apps/api/src/generated/prisma/client";
import { seedSuppliers } from "./seed-suppliers";

// Demo data every member relies on. Safe to run more than once (upserts with fixed IDs).
// Owner: Member 3 adds merchants and products here on Day 4.

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DIRECT_URL or DATABASE_URL in .env before seeding");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const ngo = await prisma.user.upsert({
    where: { email: "ngo@lifeline.demo" },
    update: {},
    create: { id: "user_demo_ngo", name: "Demo Relief NGO", email: "ngo@lifeline.demo", role: "NGO" },
  });

  await prisma.campaign.upsert({
    where: { id: "camp_demo" },
    update: {},
    create: {
      id: "camp_demo",
      title: "Emergency essentials fund (demo)",
      description: "Synthetic campaign for the hackathon demo. Not a real appeal.",
      currency: "EUR",
      goalAmount: "5000.00",
      ownerId: ngo.id,
    },
  });

  await seedSuppliers(prisma, ngo.id);

  console.log("Seeded demo NGO user, campaign camp_demo and synthetic suppliers");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
