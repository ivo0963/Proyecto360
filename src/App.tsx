// src/App.tsx
// Estructura de rutas + guards. Este es el archivo que muestra el concepto
// "guard de ruta": RequireAuth agrupa TODAS las rutas que exigen sesión, y
// RequireRole las que además exigen un App Role — se agregan más páginas
// (orders, catalog, ...) anidándolas bajo el guard que corresponda, sin
// repetir lógica de autenticación/autorización en cada una.
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from './authConfig';
import { RequireAuth } from './RequireAuth';
import { RequireRole } from './RequireRole';
import { Landing } from './Landing';
import { Dashboard } from './Dashboard';
import { Orders } from './Orders';
import { Catalog } from './Catalog';
import { AdminPanel } from './AdminPanel';
import './App.css';

function Nav() {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const handleLogin = () => {
    if (inProgress === InteractionStatus.None) {
      instance.loginRedirect(loginRequest).catch((e) => console.error(e));
    }
  };

  const handleLogout = () => {
    if (inProgress === InteractionStatus.None) {
      instance
        .logoutRedirect({ postLogoutRedirectUri: '/' })
        .catch((e) => console.error(e));
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav-link active' : 'nav-link';

  return (
    <header className="navbar">
      <div className="logo">
        📦 <span>Pedidos360</span>
      </div>

      {isAuthenticated && (
        <nav className="nav-links">
          <NavLink to="/dashboard" className={linkClass}>
            Dashboard
          </NavLink>
          {/* Sin el App Role "Admin" asignado, RequireRole igual bloquea el
              contenido — el link queda visible a propósito para poder
              demostrar el guard de autorización en vivo. */}
          <NavLink to="/orders" className={linkClass}>
            Pedidos
          </NavLink>
          <NavLink to="/catalog" className={linkClass}>
            Catálogo
          </NavLink>
          <NavLink to="/admin" className={linkClass}>
            Admin
          </NavLink>
        </nav>
      )}

      <div>
        {isAuthenticated ? (
          <button
            className="btn btn-logout"
            onClick={handleLogout}
            disabled={inProgress !== InteractionStatus.None}
          >
            Cerrar Sesión
          </button>
        ) : (
          <button
            className="btn btn-login"
            onClick={handleLogin}
            disabled={inProgress !== InteractionStatus.None}
          >
            Iniciar Sesión
          </button>
        )}
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Nav />
        <main className="container">
          <Routes>
            {/* Pública: no está bajo RequireAuth */}
            <Route path="/" element={<Landing />} />

            {/* Guard de AUTENTICACIÓN: agrupa las rutas que exigen sesión */}
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/catalog" element={<Catalog />} />

              {/* Guard de AUTORIZACIÓN anidado: además exige el rol Admin */}
              <Route element={<RequireRole role="Admin" />}>
                <Route path="/admin" element={<AdminPanel />} />
              </Route>
            </Route>

            <Route path="*" element={<Landing />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
