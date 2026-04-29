import { useEffect, useState } from "react";
import { getProgress } from "../services/apiAdmin";

function ProgressBar({ done, inProgress, total }) {
  if (total === 0) return <span className="tw-text-sm tw-text-gray-400">Aucune tâche</span>;
  const donePct = Math.round((done / total) * 100);
  const inProgPct = Math.round((inProgress / total) * 100);
  return (
    <div className="tw-w-full">
      <div className="progress tw-mb-1" style={{ height: "18px" }}>
        <div
          className="progress-bar bg-success"
          style={{ width: `${donePct}%` }}
          title={`Terminé : ${done}`}
        />
        <div
          className="progress-bar bg-warning"
          style={{ width: `${inProgPct}%` }}
          title={`En cours : ${inProgress}`}
        />
      </div>
      <div className="tw-flex tw-gap-4 tw-text-xs tw-text-gray-600">
        <span className="tw-flex tw-items-center tw-gap-1">
          <span className="tw-inline-block tw-w-3 tw-h-3 tw-rounded-sm tw-bg-green-600" />
          Terminé : {done}
        </span>
        <span className="tw-flex tw-items-center tw-gap-1">
          <span className="tw-inline-block tw-w-3 tw-h-3 tw-rounded-sm tw-bg-yellow-400" />
          En cours : {inProgress}
        </span>
        <span className="tw-flex tw-items-center tw-gap-1">
          <span className="tw-inline-block tw-w-3 tw-h-3 tw-rounded-sm tw-bg-gray-300" />
          Non commencé : {total - done - inProgress}
        </span>
        <span className="tw-ml-auto tw-font-semibold">{donePct}% complet</span>
      </div>
    </div>
  );
}

export default function AnnotatorProgress() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    getProgress()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleExpand(userId) {
    setExpanded((prev) => ({ ...prev, [userId]: !prev[userId] }));
  }

  if (loading) return <p className="tw-text-sm tw-text-gray-500">Chargement de la progression…</p>;
  if (error) return <p className="tw-text-sm tw-text-red-500">Erreur : {error}</p>;
  if (!data || data.length === 0) return <p className="tw-text-sm tw-text-gray-500">Pas encore de données d'annotation.</p>;

  return (
    <div className="tw-flex tw-flex-col tw-gap-4 tw-mb-10">
      {data.map((user) => (
        <div key={user.user_id} className="card">
          <div
            className="card-header tw-flex tw-items-center tw-justify-between tw-cursor-pointer"
            onClick={() => toggleExpand(user.user_id)}
          >
            <span className="tw-font-semibold">{user.email}</span>
            <span className="tw-text-sm tw-text-gray-500 tw-ml-4 tw-mr-auto">
              {user.total_tasks} tâche{user.total_tasks !== 1 ? "s" : ""} sur {user.evaluations.length} évaluation{user.evaluations.length !== 1 ? "s" : ""}
            </span>
            <span className="tw-text-xs tw-text-gray-400">{expanded[user.user_id] ? "▲ réduire" : "▼ développer"}</span>
          </div>
          <div className="card-body tw-pb-3">
            <ProgressBar
              done={user.total_done}
              inProgress={user.total_in_progress}
              total={user.total_tasks}
            />
          </div>
          {expanded[user.user_id] && (
            <div className="tw-border-t">
              <table className="table tw-mb-0 tw-text-sm">
                <thead>
                  <tr>
                    <th>Évaluation</th>
                    <th style={{ minWidth: "260px" }}>Progression</th>
                    <th className="tw-text-right">Terminé</th>
                    <th className="tw-text-right">En cours</th>
                    <th className="tw-text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {user.evaluations.map((ev) => (
                    <tr key={ev.evaluation_id}>
                      <td>{ev.evaluation_name}</td>
                      <td>
                        <ProgressBar
                          done={ev.done}
                          inProgress={ev.in_progress}
                          total={ev.total}
                        />
                      </td>
                      <td className="tw-text-right">{ev.done}</td>
                      <td className="tw-text-right">{ev.in_progress}</td>
                      <td className="tw-text-right">{ev.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
