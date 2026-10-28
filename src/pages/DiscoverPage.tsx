import { ArrowUpRight, FileCheck2, ShieldCheck, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import "./pages.css";

const steps = [
  {
    icon: TrendingUp,
    title: "Suivre",
    text: "Ajoutez vos transactions, vos categories et vos engagements recurrents pour voir ce qui reste disponible.",
  },
  {
    icon: FileCheck2,
    title: "Anticiper",
    text: "Visualisez les echeances avant votre prochaine paie et importez releves, factures ou tickets a verifier.",
  },
  {
    icon: ShieldCheck,
    title: "Garder la main",
    text: "L assistant peut proposer une lecture ou une categorie, mais aucune transaction ni engagement n est cree sans votre confirmation.",
  },
];

export function DiscoverPage() {
  return (
    <section className="discover-page">
      <p className="eyebrow">BIENVENUE DANS HORIZON</p>
      <h1>Votre budget, plus clair.</h1>
      <p className="description">
        Horizon vous aide a comprendre votre budget, anticiper vos echeances et
        organiser vos depenses, sans jamais enregistrer une donnee sans votre
        validation.
      </p>
      <div className="discover-meta" aria-label="Principes Horizon">
        <span>PRIVE PAR DEFAUT</span>
        <span>VALIDATION HUMAINE</span>
        <span>VISION JUSQU A LA PAIE</span>
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
          Vos donnees sont separees de celles des autres utilisateurs. L
          assistant est optionnel et vos documents restent a verifier avant
          toute saisie.
        </p>
      </section>
      <Link className="discover-start" to="/profil">
        Commencer avec Horizon <ArrowUpRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}
