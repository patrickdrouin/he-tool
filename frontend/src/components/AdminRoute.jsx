import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import Spinner from "./Spinner";
import { useAuth } from "../features/authentication/useAuth";

export default function AdminRoute({ children }) {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) navigate("/login");
      else if (!isAdmin) navigate("/annotate");
    }
  }, [isAuthenticated, isAdmin, isLoading, navigate]);

  if (isLoading) return <Spinner />;
  if (isAuthenticated && isAdmin) return <>{children}</>;
  return null;
}
