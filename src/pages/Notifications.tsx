import { useEffect, useState } from "react";
import API from "../utils/axios";
import { Link } from "react-router-dom";

type Notification = {
  _id: string;
  title: string;
  message: string;
  alertId?: string;
  read: boolean;
  createdAt: string;
};

export default function Notifications() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await API.get("/notifications");
      setNotifs(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-xl font-semibold text-black mb-4">Notifications</h2>

      {loading && <div className="text-slate-500 text-sm">Loading...</div>}

      {!loading && notifs.length === 0 && (
        <div className="text-slate-500 text-sm">No notifications</div>
      )}

      <div className="space-y-3">
        {notifs.map((n) => (
          <div
            key={n._id}
            className={`p-3 border rounded-lg ${
              n.read ? "bg-white" : "bg-black/5"
            }`}
          >
            <div className="flex justify-between">
              <div>
                <div className="font-medium">{n.title}</div>
                <div className="text-xs text-slate-600 mt-1">{n.message}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                </div>

                {n.alertId && (
                  <Link
                    to={`/alerts/${n.alertId}`}
                    className="text-xs text-black underline mt-2 inline-block"
                  >
                    View Alert
                  </Link>
                )}
              </div>

              {!n.read && (
                <button
                  onClick={() => markRead(n._id)}
                  className="text-xs text-black underline"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
