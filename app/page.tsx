import { redirect } from "next/navigation";
import { HomeLibrary } from "@/components/library/home-library";
import { getCurrentUser, isAdminUser } from "@/lib/auth";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isAdminUser(user)) redirect("/users");
  return <HomeLibrary />;
}
