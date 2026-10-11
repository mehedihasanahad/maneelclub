-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "allowedPaymentMethods" "PaymentMethod"[] DEFAULT ARRAY[]::"PaymentMethod"[];

