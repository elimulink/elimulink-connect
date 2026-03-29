import LoginPage from "../pages/Login.jsx";

export default function AppGate({
  bootState,
  children,
  deniedMessage = "You do not have access to this app.",
}) {
  if (bootState === "loading") {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (bootState === "guest") {
    return <LoginPage />;
  }

  if (bootState === "denied") {
    return <div style={{ padding: 24 }}>{deniedMessage}</div>;
  }

  return children;
}
