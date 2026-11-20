import { CheckIcon } from "@/components/icons";
import {
  MAXIMUM_SCORE,
  RUBRIC_CATEGORIES,
  TARGET_MAX_WORDS,
  TARGET_MIN_WORDS,
} from "@/lib/essay-rules";

export function MarkingScheme() {
  return (
    <aside className="sidebar" aria-label="Marking guidance">
      <section className="card" aria-labelledby="scheme-title">
        <div className="card-header">
          <div>
            <h2 className="card-title" id="scheme-title">
              Marking scheme
            </h2>
            <p className="card-subtitle">WAEC / NECO COEM rubric</p>
          </div>
        </div>
        <div className="card-body">
          <ul className="scheme-list">
            {RUBRIC_CATEGORIES.map(({ key, label, maximum, description }) => (
              <li className="scheme-item" key={key}>
                <span className="scheme-name">{label}</span>
                <span className="scheme-marks">{maximum} marks</span>
                <span className="scheme-desc">{description}</span>
              </li>
            ))}
          </ul>
          <div className="scheme-total">
            <span>Total</span>
            <span>{MAXIMUM_SCORE} marks</span>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="tips-title">
        <div className="card-header">
          <h2 className="card-title" id="tips-title">
            Getting a good photo
          </h2>
        </div>
        <div className="card-body">
          <ul className="checklist">
            <li>
              <CheckIcon />
              <span>
                Write by hand in dark ink, as in the exam. Aim for{" "}
                {TARGET_MIN_WORDS}–{TARGET_MAX_WORDS} words.
              </span>
            </li>
            <li>
              <CheckIcon />
              <span>Lay each page flat in good light, without shadows.</span>
            </li>
            <li>
              <CheckIcon />
              <span>Fit the whole page in the frame and keep it sharp.</span>
            </li>
            <li>
              <CheckIcon />
              <span>Add the pages in order: page 1 first.</span>
            </li>
            <li>
              <CheckIcon />
              <span>
                Words that can’t be read can’t earn marks, just like in the
                exam.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </aside>
  );
}
