import { Suspense } from "react";
import MessagesClient from "./messages-client";

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesClient />
    </Suspense>
  );
}
