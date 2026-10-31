import { ArrowUpRight, FileCheck2, PiggyBank, ShieldCheck, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import "./pages.css";

const steps = [
  {
    icon: TrendingUp,
    title: "Suivre",
    text: "Ajoutez vos transactions, vos catégories et vos engagements récurrents pour comprendre ce qui est déjà utilisé et ce qui reste disponible.",
  },
  {
    icon: FileCheck2,
    title: "Anticiper",
    text: "Visualisez les échéances avant votre prochaine paie et le montant quotidien prudent. Affectez aussi un revenu ponctuel à un objectif d’épargne.",
  },
  {
    icon: ShieldCheck,
    title: "Vérifier les imports",
    text: "Importez un relevé, une facture ou un ticket. Chaque ligne reste à vérifier : confirmez-la ou ignorez-la ensuite dans Transactions.",
  },
  {
    icon: PiggyBank,
    title: "Garder la main",
    text: "L’assistant peut proposer une lecture ou une catégorie, mais aucune transaction ni aucun engagement n’est créé sans votre confirmation.",
  },
];

export function DiscoverPage() {
  return (
    <section className="discover-page">
      <p className="eyebrow">BIENVENUE DANS HORIZON</p>
      <h1>Votre budget, plus clair.</h1>
      <p className="description">
        Horizon vous aide à organiser vos revenus, sorties, épargne et échéances. Les calculs anticipent votre prochaine paie, tandis que chaque import ou proposition de l’assistant reste sous votre contrôle.
      </p>
      <div className="discover-meta" aria-label="Principes Horizon">
        <span>PRIVÉ PAR DÉFAUT</span>
        <span>VALIDATION HUMAINE</span>
        <span>VISION JUSQU’À LA PAIE</span>
      </div>
      <div className="discover-steps">
        {steps.map(({ icon: Icon, title, text }) => (
          <article className="discover-step" key={title}>
            <Icon size={22} aria-hidden="true" />
            <div>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </div>
      <section className="discover-privacy">
        <ShieldCheck size={19} aria-hidden="true" />
        <p>
          Vos données sont séparées de celles des autres utilisateurs. L’
          assistant est optionnel et vos documents restent à vérifier avant
          toute saisie.
        </p>
      </section>
      <Link className="discover-start" to="/profil">
        Commencer avec Horizon <ArrowUpRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}
