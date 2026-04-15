import { useQuery } from "@tanstack/react-query";

async function fetchUsers() {
  const response = await fetch("/api/users", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch users");
  return response.json();
}

export function useUsers() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  return { users, isLoading };
}
