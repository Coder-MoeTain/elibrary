import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { useAuth } from "./AuthContext";
import { getAppSettings, type AppSettings } from "../services/api";
import {
  DEFAULT_TIMEZONE,
  calendarDate,
  formatClockLabel,
  formatDateOnly,
  formatDateTime,
  formatTime,
  type TimezoneGroup
} from "../utils/datetime";

type TimezoneContextType = {
  timezone: string;
  offset: string;
  today: string;
  groups: TimezoneGroup[];
  loading: boolean;
  refresh: () => Promise<void>;
  applySettings: (next: AppSettings) => void;
  formatDateTime: (value: string | Date | null | undefined) => string;
  formatDateOnly: (value: string | null | undefined) => string;
  formatTime: (value?: string | Date) => string;
  formatClock: (date?: Date) => string;
  todayYmd: () => string;
};

const TimezoneContext = createContext<TimezoneContextType | null>(null);

const emptyGroups: TimezoneGroup[] = [];

export const TimezoneProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [offset, setOffset] = useState("UTC+06:30");
  const [today, setToday] = useState(() => calendarDate(DEFAULT_TIMEZONE));
  const [groups, setGroups] = useState<TimezoneGroup[]>(emptyGroups);
  const [loading, setLoading] = useState(false);

  const applySettings = useCallback((next: AppSettings) => {
    setTimezone(next.timezone || DEFAULT_TIMEZONE);
    setOffset(next.offset || "");
    setToday(next.today || calendarDate(next.timezone || DEFAULT_TIMEZONE));
    if (next.groups?.length) setGroups(next.groups);
  }, []);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem("token")) return;
    setLoading(true);
    try {
      const data = await getAppSettings();
      applySettings(data);
    } catch {
      /* keep last known timezone */
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void refresh();
  }, [isAuthenticated, refresh]);

  const value = useMemo<TimezoneContextType>(
    () => ({
      timezone,
      offset,
      today,
      groups,
      loading,
      refresh,
      applySettings,
      formatDateTime: (value) => formatDateTime(value, timezone),
      formatDateOnly,
      formatTime: (value) => formatTime(value ?? new Date(), timezone),
      formatClock: (date) => formatClockLabel(date ?? new Date(), timezone),
      todayYmd: () => calendarDate(timezone)
    }),
    [timezone, offset, today, groups, loading, refresh, applySettings]
  );

  return <TimezoneContext.Provider value={value}>{children}</TimezoneContext.Provider>;
};

export const useTimezone = () => {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error("useTimezone must be used within TimezoneProvider");
  }
  return context;
};
