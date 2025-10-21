import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { Layout } from './components/Layout'
import Dashboard from './pages/Dashboard'
import PracticeManagement from './pages/PracticeManagement'
import { UserAdministration } from './pages/UserAdministration'
import { TariffManagement } from './pages/TariffManagement'
import { SMSManagement } from './pages/SMSManagement'
import { SMSLogs } from './pages/SMSLogs'
import { Analytics } from './pages/Analytics'
import { PatientData } from './pages/PatientData'
import { Appointments } from './pages/Appointments'
import { BillingFinance } from './pages/BillingFinance'
import { SupportCenter } from './pages/SupportCenter'
import { SystemLogs } from './pages/SystemLogs'
import { Database } from './pages/Database'
import { SystemBlueprint } from './pages/SystemBlueprint'
import { Notifications } from './pages/Notifications'
import { Security } from './pages/Security'
import { Settings } from './pages/Settings'

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/practice-management" element={<PracticeManagement />} />
            <Route path="/user-administration" element={<UserAdministration />} />
            <Route path="/tariff-management" element={<TariffManagement />} />
            <Route path="/sms-management" element={<SMSManagement />} />
            <Route path="/sms-logs" element={<SMSLogs />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/patient-data" element={<PatientData />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/billing-finance" element={<BillingFinance />} />
            <Route path="/support-center" element={<SupportCenter />} />
            <Route path="/system-logs" element={<SystemLogs />} />
            <Route path="/database" element={<Database />} />
            <Route path="/system-blueprint" element={<SystemBlueprint />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/security" element={<Security />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  )
}

export default App
