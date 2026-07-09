import { prisma } from './src/prisma';

async function test() {
  try {
    const user = await prisma.user.findFirst({
      select: { id: true, name: true, email: true, role: true, createdAt: true, profilePictureUrl: true, paymentAccountType: true, paymentAccountNumber: true, companyId: true, company: { select: { maxPadLimit: true, allowSalesChat: true, requireManagerApproval: true } } }
    });
    console.log(user);
  } catch (error) {
    console.error('Error in getMe query:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
