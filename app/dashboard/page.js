"use client";
// app/dashboard/page.js
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { BarChart3, FileText, Eye, Heart, Users, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const { user, sessionReady } = useCurrentUser();
  const [stats, setStats] = useState({
    postsCount: 0,
    totalViews: 0,
    totalLikes: 0,
    totalFriends: 0,
  });
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboardStats() {
    if (!user?.uid) return;
    setLoading(true);
    setError("");
    try {
      // 1. Fetch user's posts
      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select("id, text, image_url, video_url, likes, comments_count, created_at")
        .eq("author_id", user.uid)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      const userPostsList = posts || [];
      const postsCount = userPostsList.length;

      // Calculate total likes from post list
      const totalLikes = userPostsList.reduce((acc, p) => acc + (p.likes || 0), 0);

      // 2. Fetch total views from analytics table
      let totalViews = 0;
      if (postsCount > 0) {
        const postIds = userPostsList.map((p) => p.id);
        const { count: viewsCount, error: viewsError } = await supabase
          .from("analytics")
          .select("*", { count: "exact", head: true })
          .in("post_id", postIds);

        if (viewsError) throw viewsError;
        totalViews = viewsCount || 0;
      }

      // 3. Fetch count of accepted friends
      const { count: friendsCount, error: friendsError } = await supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("status", "accepted")
        .or(`user_id_1.eq.${user.uid},user_id_2.eq.${user.uid}`);

      if (friendsError) throw friendsError;

      setStats({
        postsCount,
        totalViews,
        totalLikes,
        totalFriends: friendsCount || 0,
      });

      // Get individual post view counts for breakdown list
      const breakdownList = [];
      for (const p of userPostsList) {
        const { count: pViews } = await supabase
          .from("analytics")
          .select("*", { count: "exact", head: true })
          .eq("post_id", p.id);
        
        breakdownList.push({
          ...p,
          views: pViews || 0,
        });
      }
      setUserPosts(breakdownList);

    } catch (err) {
      setError(err.message || "Impossible de charger les données analytiques.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.uid && sessionReady) {
      loadDashboardStats();
    }
  }, [user?.uid, sessionReady]);

  return (
    <div className="min-h-screen pb-16 bg-bg">
      <Header user={user} />
      <MobileNav />
      <main className="max-w-6xl mx-auto pt-20 px-3 flex gap-6">
        <LeftSidebar user={user} />
        <section className="flex-1 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-electric" size={24} />
            <h1 className="font-display text-2xl font-bold text-slate-800">Tableau de bord</h1>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {loading ? (
            <div className="card-lg p-20 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-electric rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-semibold">Analyse de vos publications en cours…</p>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={FileText} label="Publications" value={stats.postsCount} color="text-blue-500 bg-blue-50" />
                <StatCard icon={Eye} label="Vues uniques" value={stats.totalViews} color="text-emerald-500 bg-emerald-50" />
                <StatCard icon={Heart} label="Mentions J'aime" value={stats.totalLikes} color="text-rose-500 bg-rose-50" />
                <StatCard icon={Users} label="Amis connectés" value={stats.totalFriends} color="text-indigo-500 bg-indigo-50" />
              </div>

              {/* Publications breakdown */}
              <div className="card-lg p-5">
                <h3 className="font-display font-bold text-slate-800 text-base mb-4">Performance par publication</h3>
                {userPosts.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-10">
                    Vous n'avez pas encore publié de post pour le moment.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                          <th className="pb-3 font-semibold">Contenu</th>
                          <th className="pb-3 font-semibold">Date</th>
                          <th className="pb-3 font-semibold text-center">Vues</th>
                          <th className="pb-3 font-semibold text-center">J'aime</th>
                          <th className="pb-3 font-semibold text-center">Commentaires</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                        {userPosts.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/55 transition-colors">
                            <td className="py-3.5 pr-4 max-w-xs truncate font-medium">
                              {p.text || (p.image_url ? "📷 Photo" : p.video_url ? "🎥 Vidéo" : "Publication")}
                            </td>
                            <td className="py-3.5 text-slate-400 text-xs">
                              {new Date(p.created_at).toLocaleDateString("fr-FR")}
                            </td>
                            <td className="py-3.5 text-center font-semibold text-slate-800">{p.views}</td>
                            <td className="py-3.5 text-center font-semibold text-slate-800">{p.likes || 0}</td>
                            <td className="py-3.5 text-center font-semibold text-slate-800">{p.comments_count || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-5 flex items-center gap-4 hover:shadow-glow transition-all duration-300">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-extrabold text-slate-800 mt-1 leading-none">{value}</p>
      </div>
    </div>
  );
}
