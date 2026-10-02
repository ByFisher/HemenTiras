import { z } from "zod";

const email = z.string().trim().email("Geçerli bir e-posta adresi girin.");
const password = z.string().min(12, "Parola en az 12 karakter olmalıdır.");

export const customerRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalıdır.").max(120),
  email,
  password,
  passwordConfirmation: z.string(),
  phone: z.string().trim().min(1, "Telefon numarası gereklidir.").max(40, "Telefon en fazla 40 karakter olabilir."),
  city: z.string().trim().min(1, "İl seçilmelidir.").max(120),
  district: z.string().trim().min(1, "İlçe seçilmelidir.").max(120),
}).refine((values) => values.password === values.passwordConfirmation, {
  message: "Parolalar eşleşmiyor.",
  path: ["passwordConfirmation"],
});

export const shopOwnerRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalıdır.").max(120),
  email,
  password,
  passwordConfirmation: z.string(),
  shopName: z.string().trim().min(2, "Dükkan adı en az 2 karakter olmalıdır.").max(120),
  phone: z.string().trim().min(1, "Telefon numarası gereklidir.").max(40, "Telefon en fazla 40 karakter olabilir."),
  city: z.string().trim().min(1, "İl gereklidir.").max(120),
  district: z.string().trim().min(1, "İlçe gereklidir.").max(120),
}).refine((values) => values.password === values.passwordConfirmation, {
  message: "Parolalar eşleşmiyor.",
  path: ["passwordConfirmation"],
});

export type CustomerRegistrationForm = z.infer<typeof customerRegistrationSchema>;
export type ShopOwnerRegistrationForm = z.infer<typeof shopOwnerRegistrationSchema>;
