import { SignUp } from "@clerk/nextjs";
export default function Page() {
  return (
    <main className="min-h-[80vh] grid place-items-center p-6">
      <SignUp />
    </main>
  );
}
