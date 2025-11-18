import React, { type JSX } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Login from "../pages/Login";
import PageWrapper from "../components/layout/PageWrapper";
import Dashboard from "../pages/Dasboard";
import UploadEvents from "../pages/EventsVerified";
import AlertsList from "../pages/AlertsList";
import AlertDetails from "../pages/AlertsDetails";
import UploadFrameworkTable from "../components/UploadFrameworkTable";


const PrivateRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <PageWrapper>
              <Dashboard />
            </PageWrapper>
          </PrivateRoute>
        }
      />

      <Route
        path="/upload/framework"
        element={
          <PrivateRoute>
            <PageWrapper>
              <UploadFrameworkTable />
            </PageWrapper>
          </PrivateRoute>
        }
      />

      <Route
        path="/upload/events"
        element={
          <PrivateRoute>
            <PageWrapper>
              <UploadEvents />
            </PageWrapper>
          </PrivateRoute>
        }
      />

      <Route
        path="/alerts"
        element={
          <PrivateRoute>
            <PageWrapper>
              <AlertsList />
            </PageWrapper>
          </PrivateRoute>
        }
      />

      <Route
        path="/alerts/:id"
        element={
          <PrivateRoute>
            <PageWrapper>
              <AlertDetails />
            </PageWrapper>
          </PrivateRoute>
        }
      />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
