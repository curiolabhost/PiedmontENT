// generate-data.js
// Generates JSON data files for the ENT Reference app from inline clinical content.
// Run from project root: node generate-data.js

import fse from 'fs-extra';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DIRS = { dx: 'diagnoses', proc: 'procedures', ma: 'protocols' };

function bid() { return crypto.randomBytes(4).toString('hex'); }
const h = (s) => ({ id: bid(), type: 'h3', content: s });
const p = (s) => ({ id: bid(), type: 'p', content: s });
const li = (s) => ({ id: bid(), type: 'li', content: s });
const warn = (s) => ({ id: bid(), type: 'alert-warn', content: s });
const info = (s) => ({ id: bid(), type: 'alert-info', content: s });
const note = (s) => ({ id: bid(), type: 'alert-note', content: s });
const step = (s, n) => {
  const b = { id: bid(), type: 'checklist-step', content: s };
  if (n) b.note = n;
  return b;
};

const NOW = '2024-01-01T00:00:00.000Z';

const entries = [];

// ============================================================================
// NOSE — DIAGNOSES
// ============================================================================

entries.push({
  id: 'chronic-sinusitis',
  type: 'dx',
  region: 'nose',
  title: 'Chronic Sinusitis',
  desc: 'Inflammation of the nasal cavity and paranasal sinuses lasting 12 weeks or longer despite medical management.',
  blocks: [
    p('Chronic sinusitis (formally chronic rhinosinusitis, CRS) is defined as inflammation of the nasal cavity and paranasal sinuses lasting 12 weeks or longer despite medical management. It is one of the most common conditions seen in ENT.'),
    h('Pathophysiology'),
    p('The sinuses are air-filled cavities lined with mucosa that drain through small openings called ostia into the nasal cavity. When those ostia get blocked — by swelling, polyps, deviated septum, or thickened mucus — drainage fails, mucus stagnates, and infection or inflammation becomes chronic. There are two major subtypes: CRS with nasal polyps (CRSwNP) and CRS without nasal polyps (CRSsNP). Polyp patients are covered in the Nasal Polyps entry below.'),
    h('Symptoms'),
    p('The four cardinal symptoms are nasal obstruction, nasal discharge (anterior or posterior), facial pain/pressure, and reduction or loss of smell. Diagnosis requires two or more of these lasting 12+ weeks, plus objective evidence — either nasal endoscopy findings or CT changes. Patients will also complain of fatigue, headache, ear pressure, and postnasal drip. Facial pain alone, without other sinonasal symptoms, is rarely sinusitis — more often migraine or trigeminal neuralgia.'),
    h('Workup'),
    p('In-office nasal endoscopy is the primary diagnostic tool. If the presentation is acute, antibiotics are started empirically. If the patient is chronic and has already failed one or two rounds of antibiotics without improvement, the next step is culture and/or MicroGen PCR testing to identify the organism and resistance pattern — this is how you stop guessing and start treating specifically.'),
    p('CT sinuses (non-contrast) is ordered after failed medical management, not at the first visit. The CT tells us whether the sinuses are significantly diseased enough to warrant surgical intervention. Surgery becomes the conversation when the CT shows persistent opacification, OMC obstruction, or anatomic obstruction that medical therapy cannot fix — the sinuses physically cannot drain no matter how many antibiotics the patient takes if the drainage pathway is structurally blocked. We do not use MRI for routine sinusitis evaluation. For patients who have recurrent infections despite appropriate treatment, workup for immunodeficiency is appropriate — specifically IgA and IgG subclasses.'),
    h('Medical treatment ladder'),
    li('First line: intranasal corticosteroid sprays (Flonase, Nasacort, Nasonex, Budesonide) — teach patients proper technique; the nozzle should angle toward the outer wall, not the septum'),
    li('Nasal saline irrigation — large-volume, low-pressure (NeilMed or neti pot); saline sprays are inadequate volume and do not count'),
    li('Short courses of oral steroids (prednisone) for acute exacerbations'),
    li('Antibiotics — typically a 3–6 week course for CRS, often doxycycline or amoxicillin-clavulanate; culture-directed when possible and preferred in refractory cases'),
  ],
  related: ['nasal-polyps', 'allergic-rhinitis', 'fess', 'ct-sinuses', 'ma-ct', 'steroid-inj'],
});

entries.push({
  id: 'nasal-polyps',
  type: 'dx',
  region: 'nose',
  title: 'Nasal Polyps',
  desc: 'Benign, non-cancerous, grape-like outgrowths of the sinonasal mucosa that develop in the setting of chronic inflammation.',
  blocks: [
    p('Nasal polyps are benign, non-cancerous, grape-like outgrowths of the sinonasal mucosa that develop in the setting of chronic inflammation. They are almost always bilateral — a unilateral polyp should raise concern and warrants further workup to rule out inverted papilloma or malignancy. Polyps are the hallmark of CRSwNP and represent a more severe, eosinophilic, type-2 inflammatory phenotype. Patients with nasal polyps frequently have comorbid allergic rhinitis and asthma.'),
    warn('A unilateral polyp should raise concern and warrants further workup to rule out inverted papilloma or malignancy.'),
    h('Symptoms'),
    p('Nasal obstruction is often profound and bilateral. Loss of smell (anosmia) is a prominent feature — more so than in CRS without polyps. Patients frequently describe not being able to smell anything for months or years. Postnasal drip, facial pressure, and recurrent infections are also common.'),
    h('Diagnosis'),
    p('Nasal endoscopy will show pale, gelatinous masses arising typically from the middle meatus. CT sinuses will show soft tissue density filling the sinuses, often extensively. Polyps cannot be definitively distinguished from mucosal thickening on CT alone, but the pattern and clinical picture together make the diagnosis clear in most cases.'),
    h('Medical management'),
    p('Intranasal corticosteroids are the backbone of maintenance therapy. Oral steroid bursts (Medrol dose packs or prednisone tapers) provide temporary reduction but polyps regrow. When polyps are severe, refractory, or unresponsive to both systemic steroids and topical steroid treatment — including budesonide irrigation and intranasal sprays like Flonase — biologics are the next step. Surgery (FESS) is appropriate for debulking but polyps recur without addressing the underlying inflammation. Biologics are significantly changing the long-term management picture.'),
    h('Biologics'),
    p('<strong>Dupilumab (Dupixent)</strong> is the most established biologic for CRSwNP and the one most commonly used in ENT. It is a monoclonal antibody targeting the IL-4 receptor alpha subunit, blocking both IL-4 and IL-13 signaling — the central drivers of type-2 eosinophilic inflammation. FDA-approved for CRSwNP, atopic dermatitis, and asthma, making it particularly useful for patients carrying all three diagnoses. Administered subcutaneously — 600 mg loading dose (two 300 mg injections at the first visit), then 300 mg every 2 weeks. Patients self-inject at home after initial training. Clinical trials showed significant polyp reduction, improvement in nasal obstruction, and meaningful recovery of smell. It does not cure polyps — patients must stay on it to maintain benefit.'),
    p('<strong>Tezepelumab (Tezspire)</strong> targets TSLP (thymic stromal lymphopoietin), an epithelial cytokine that sits upstream of the IL-4/IL-13/IL-5 cascade, making it a broader-acting biologic. FDA-approved for severe asthma and has shown benefit in CRSwNP, particularly in patients with comorbid asthma. Less established in ENT than Dupixent but increasingly relevant. Administered as 210 mg subcutaneously every 4 weeks.'),
    p('<strong>Mepolizumab (Nucala)</strong> targets IL-5, the primary cytokine driving eosinophil production and survival. FDA-approved for severe eosinophilic asthma and CRSwNP. A good choice when eosinophil counts are markedly elevated and the patient has eosinophilic disease across multiple organ systems. Administered as 100 mg subcutaneously every 4 weeks.'),
    info('Insurance prior authorization is required for all three. Diagnosis code J33.0. Documentation requirements include confirmed endoscopic polyps, failed intranasal corticosteroids for at least 4 weeks, failed oral corticosteroids, and surgical history or documented contraindication to surgery.'),
  ],
  related: ['chronic-sinusitis', 'allergic-rhinitis', 'fess', 'steroid-inj'],
});

entries.push({
  id: 'allergic-rhinitis',
  type: 'dx',
  region: 'nose',
  title: 'Allergic Rhinitis',
  desc: 'IgE-mediated inflammation of the nasal mucosa triggered by allergen exposure.',
  blocks: [
    p('Allergic rhinitis (AR) is IgE-mediated inflammation of the nasal mucosa triggered by allergen exposure. It is classified as seasonal (pollens — trees in spring, grasses in summer, ragweed in fall) or perennial (dust mites, mold, pet dander, cockroach). Many patients have both. It affects roughly 20–30% of the general population and is a major driver of CRS, otitis media with effusion, and eustachian tube dysfunction.'),
    h('Symptoms'),
    p('Classic triad of rhinorrhea, sneezing, and nasal congestion, plus nasal itching. Ocular symptoms (itchy, watery eyes) are common in seasonal AR. On endoscopy, findings include pale or bluish boggy turbinate hypertrophy, posterior pharyngeal cobblestoning from lymphoid tissue hypertrophy, and in some patients tonsillar hypertrophy.'),
    h('Diagnosis'),
    p('Primarily clinical. Allergy skin prick testing is the gold standard for identifying specific triggers. Specific IgE blood testing (ImmunoCAP, formerly RAST) is the alternative when skin testing is contraindicated — this includes patients with severe eczema who cannot produce an interpretable wheal response, patients who cannot hold antihistamines, patients on beta blockers (epinephrine is less effective in anaphylaxis if skin testing provokes a systemic reaction and the patient is beta-blocked), and patients on sedating medications they cannot safely stop.'),
    h('Medical treatment'),
    li('Intranasal corticosteroids (Ryaltris, Flonase) — first-line, most effective single agent for AR'),
    li('Oral antihistamines — second-generation preferred: cetirizine (Zyrtec), fexofenadine (Allegra), loratadine (Claritin); first-generation: diphenhydramine (Benadryl), chlorpheniramine (Chlor-Trimeton) — sedating'),
    li('Intranasal antihistamines — azelastine, olopatadine (Patanase); faster onset than oral'),
    li('Leukotriene receptor antagonists — montelukast (Singulair); modest efficacy; FDA boxed warning for neuropsychiatric events including depression and suicidal ideation — patients must be counseled before starting'),
    warn('Montelukast (Singulair) carries an FDA boxed warning for neuropsychiatric events including depression and suicidal ideation — patients must be counseled before starting.'),
    h('Immunotherapy'),
    p('Allergen immunotherapy is the only disease-modifying treatment for allergic rhinitis. Available as subcutaneous injections (allergy shots) or sublingual drops/tablets. Duration is tailored to disease severity:'),
    li('Mild: approximately 3 years'),
    li('Moderate: approximately 4 years'),
    li('Severe: approximately 5 years'),
    li('Extremely severe: 5 years or longer, individualized'),
  ],
  related: ['chronic-sinusitis', 'nasal-polyps', 'rhinaer', 'steroid-inj'],
});

entries.push({
  id: 'epistaxis',
  type: 'dx',
  region: 'nose',
  title: 'Epistaxis',
  desc: 'Nosebleed — one of the most common ENT presentations seen in the office and emergency setting.',
  blocks: [
    p("Epistaxis (nosebleed) is one of the most common ENT presentations seen in the office and emergency setting. The vast majority of nosebleeds originate from Kiesselbach's plexus on the anterior septum (Little's area) — a confluence of several small vessels on the anterior septum that is superficial, accessible in office, and visible without endoscopy."),
    h('Anterior vs. posterior bleeds'),
    p("Anterior bleeds come from Little's area and are manageable in office with silver nitrate or electrocautery under local anesthesia. Posterior bleeds originate from the sphenopalatine artery territory — they do not respond to silver nitrate, tend to be more severe, and may require OR-level electrocautery, endoscopic sphenopalatine artery ligation, or interventional radiology embolization in recurrent or uncontrolled cases."),
    h('Common triggers'),
    p('Dry air, nose picking, trauma, anticoagulation, hypertension, topical nasal steroid sprays (if aimed incorrectly at the septum rather than the lateral wall), and hereditary hemorrhagic telangiectasia (HHT) in recurrent bilateral cases.'),
    warn('<strong>Never cauterize both sides of the septum in the same session</strong> — bilateral cautery risks septal perforation from bilateral ischemia of the septal tissue. If the contralateral side needs attention, it must be done at a separate visit after the first side has healed.'),
    h('Post-procedure patient instructions'),
    p('No nose blowing for 24–48 hours, no nose picking, apply nasal gel spray to keep the area moist, no strenuous activity or anything that increases head or facial pressure — this includes massage and chiropractic manipulation.'),
  ],
  related: ['cauterization', 'ma-cautery'],
});

// ============================================================================
// NOSE — PROCEDURES
// ============================================================================

entries.push({
  id: 'fess',
  type: 'proc',
  region: 'nose',
  title: 'Functional Endoscopic Sinus Surgery (FESS)',
  desc: 'Surgical treatment for CRS that has failed adequate medical management, restoring sinus drainage by opening the natural ostia.',
  blocks: [
    p('FESS is the surgical treatment for CRS that has failed adequate medical management. The goal is to restore normal sinus drainage by opening the natural ostia — not to strip all mucosa, which is a common patient misconception. Done under general anesthesia, outpatient. Image guidance (IGS/CT-guided navigation) is used in complex anatomy or revision cases.'),
    h('What is actually done'),
    p('The surgeon works entirely through the nostrils with an endoscope — no external incisions. Depending on which sinuses are involved:'),
    li('Maxillary antrostomy — widening the maxillary sinus opening into the nasal cavity, allowing drainage of the largest sinus'),
    li('Anterior and/or posterior ethmoidectomy — opening the ethmoid air cells, which sit between the orbit and the nasal cavity; often described as opening a honeycomb of small interconnected cavities'),
    li('Sphenoidotomy — opening the sphenoid sinus, which sits at the posterior skull base'),
    li('Frontal sinusotomy — opening the frontal sinus drainage pathway; the most technically demanding portion of the case because the frontal recess anatomy is highly variable and the skull base and orbit are immediately adjacent'),
    p('The more sinuses involved, the longer the case. A full four-sinus FESS runs 90 minutes to over two hours.'),
    h('Surgical risks'),
    p('Orbital injury (the lamina papyracea — the medial orbital wall — is paper thin and separates the ethmoid cells from the orbit), CSF leak from skull base entry, optic nerve injury, epiphora from nasolacrimal duct injury, anosmia, and bleeding.'),
    h('Intraoperative culture'),
    p('If culture or MicroGen PCR testing is performed during surgery, the patient is placed on antibiotics based on the result. In some cases, antibiotics are intentionally held until surgery — prior antibiotic exposure can suppress organisms and make culture results unreliable or misleading, so holding allows for a clean intraoperative sample.'),
    h('Post-operative follow-up'),
    p('The patient is seen weekly for approximately three weeks following surgery for in-office debridement — removal of crusts, dried blood, and fibrinous material that accumulates as the surgical cavities heal. This is not optional. Debridement is a critical part of the healing process and directly affects the long-term outcome of the surgery.'),
    note('Debridement is not optional. It is a critical part of the healing process and directly affects the long-term outcome of the surgery.'),
  ],
  related: ['chronic-sinusitis', 'nasal-polyps', 'ct-sinuses', 'septoplasty', 'ma-preop', 'ma-ct'],
});

entries.push({
  id: 'septoplasty',
  type: 'proc',
  region: 'nose',
  title: 'Septoplasty and Turbinate Reduction',
  desc: 'Surgical correction of a deviated nasal septum and reduction of hypertrophied turbinates causing functional nasal obstruction.',
  blocks: [
    h('Septoplasty'),
    p('<strong>Septoplasty</strong> corrects a deviated nasal septum causing functional obstruction. Cosmetic nasal reshaping is rhinoplasty — septoplasty is strictly internal and the two are completely different procedures. Frequently combined with turbinate reduction or FESS in the same case. General anesthesia, outpatient, approximately 60 minutes.'),
    p("Insurance requires documented medical necessity — obstruction, failed conservative management, and functional impact on breathing. Prior authorization documentation is largely the MA's responsibility: symptom duration, prior treatments, and imaging must all be clearly in the chart before submitting."),
    p('Complications: septal perforation (rare but serious), bleeding, septal hematoma (a post-op emergency that must be recognized and drained urgently — present as fluctuant bulging of the septum, painful, within the first 24–48 hours), saddle nose deformity from excessive cartilage removal, and persistent deviation.'),
    warn('<strong>Septal hematoma is a post-op emergency.</strong> Present as fluctuant bulging of the septum, painful, within the first 24–48 hours. Must be recognized and drained urgently.'),
    h('Turbinate reduction'),
    p('<strong>Turbinate reduction:</strong> The inferior turbinates regulate airflow and humidify inspired air. In chronic AR or vasomotor rhinitis they become chronically hypertrophied and obstruct breathing. In our practice, in-office turbinate reduction is performed with the RhinAer device (radiofrequency). In the OR, turbinate reduction is performed concurrently with septoplasty or FESS using a microdebrider or electrocautery technique.'),
    p('Two important cautions: First, patients with underlying allergies can experience a flare of turbinate hypertrophy even after surgical reduction — the now-wider nasal airway exposes the mucosa to greater allergen load, triggering renewed inflammatory swelling. Second, for this reason, many patients undergo allergy skin testing and are placed on appropriate allergy treatment concurrently with or prior to surgery, unless the septal deviation is severe enough to make surgery the immediate priority regardless.'),
    warn('Always submucosal reduction — over-resection of the turbinate causes empty nose syndrome, a debilitating and irreversible condition where the nose is anatomically wide open but the patient feels constant suffocating obstruction because the normal sensory feedback from turbinate airflow is permanently lost.'),
  ],
  related: ['fess', 'ma-preop', 'allergic-rhinitis', 'rhinaer'],
});

entries.push({
  id: 'ct-sinuses',
  type: 'proc',
  region: 'nose',
  title: 'CT Scan of the Sinuses',
  desc: 'Non-contrast CT of the paranasal sinuses — imaging standard for CRS evaluation and surgical planning.',
  blocks: [
    p('CT of the paranasal sinuses — not a head CT, not a CT with contrast — is the imaging standard for CRS evaluation and surgical planning. For image-guided surgery (IGS), the scan parameters matter: typically a fine-cut non-contrast protocol, approximately 20 seconds acquisition time. American Health Imaging is a facility known to offer IGS-compatible CT protocols — confirm with the facility that the scan meets navigation system specifications before sending the patient.'),
    h('Protocol'),
    li('Non-contrast — contrast adds nothing for mucosal sinus disease'),
    li('Coronal and axial planes reviewed; sagittal reconstructions useful for frontal recess anatomy'),
    li('Fine cuts (≤1 mm) for surgical planning; 3 mm cuts adequate for initial diagnostic evaluation'),
    li("For IGS, the CT must be acquired per the specific navigation system's protocol — coordinate with the OR before scheduling the scan"),
    h('What is on the report'),
    li('Ostiomeatal complex (OMC) — the central drainage pathway for the frontal, maxillary, and anterior ethmoid sinuses; OMC obstruction is the anatomic root of most CRS'),
    li('Mucosal thickening — extent and distribution'),
    li('Air-fluid levels — suggest acute superimposed infection on chronic disease'),
    li('Orbital walls and skull base — critical safety landmarks for FESS planning'),
    note('When ordering, verify the correct protocol (without contrast, sinus-specific, not head CT). If the patient had imaging at an outside facility, obtain the DICOM files — not just the written report. The surgeon needs the actual images for surgical planning. A report without images is not usable.'),
  ],
  related: ['chronic-sinusitis', 'nasal-polyps', 'fess', 'ma-ct'],
});

entries.push({
  id: 'cauterization',
  type: 'proc',
  region: 'nose',
  title: 'Nasal Cauterization — Chemical and Electrical',
  desc: 'In-office cauterization for epistaxis using silver nitrate or electrocautery to ablate the bleeding vessel.',
  blocks: [
    p('Cauterization is used primarily for epistaxis — to ablate the bleeding vessel. Local anesthetic used is typically 1% or 2% lidocaine with epinephrine 1:100,000 — the epinephrine provides vasoconstriction that reduces active bleeding and improves visualization of the vessel.'),
    h('Chemical cauterization — silver nitrate'),
    p('Agent: 75% silver nitrate applicator stick.'),
    li('Obtain signed consent'),
    li('Apply topical anesthetic — lidocaine or tetracaine to the nasal mucosa; allow adequate dwell time'),
    li('Identify the bleeding site'),
    li('Apply the silver nitrate tip directly to the vessel, rolling gently for a few seconds until a gray-white eschar forms — do not press hard or hold too long'),
    li('Cut a small piece of Surgicel (approximately 1.5 cm x 1.5 cm), coat with mupirocin ointment, and apply over the cauterized area'),
    li('Do not cauterize both sides of the septum in the same session — bilateral ischemia risks perforation'),
    li('Post-procedure: no nose blowing 24–48 hours, no nose picking, nasal gel spray, no strenuous activity, no massage or chiropractic manipulation'),
    h('Electrical cauterization (electrocautery)'),
    p("Used when chemical cauterization has failed, the vessel is too large for silver nitrate, or the bleed is posterior and beyond Little's area. A bipolar or monopolar electrocautery unit is used under endoscopic visualization — in-office under local anesthesia or in the OR under general for posterior or arterial-level bleeds."),
    p('Posterior bleeds involve the sphenopalatine artery territory and may ultimately require OR-level electrocautery, endoscopic sphenopalatine artery ligation, or interventional radiology embolization in severe or recurrent cases.'),
    note("For monopolar cautery: the grounding pad is placed on the patient's back or thigh. Know where the unit is, confirm it powers on, and have it set up before the provider enters the room."),
  ],
  related: ['epistaxis', 'ma-cautery'],
});

entries.push({
  id: 'vivaer',
  type: 'proc',
  region: 'nose',
  title: 'Vivaer',
  desc: 'In-office radiofrequency treatment for nasal airway obstruction caused by internal nasal valve collapse.',
  blocks: [
    p('Vivaer (Aerin Medical) is an in-office radiofrequency treatment for nasal airway obstruction caused by nasal valve collapse — specifically the internal nasal valve, where the cartilaginous lateral wall collapses inward on inhalation and limits airflow. This is a structural problem, not a secretomotor or mucosal problem — that distinction determines patient selection.'),
    h('Mechanism'),
    p('A handheld RF wand delivers controlled thermal energy to the internal nasal valve region. The heat remodels the cartilage and soft tissue — stiffening the lateral wall so it no longer collapses dynamically with inhalation. No tissue is cut or removed. The remodeling response develops over 4–6 weeks as fibrosis sets in. Patients should not judge results immediately after the procedure.'),
    h('Patient selection'),
    p("The Cottle maneuver is used as a quick screen — the examiner gently pulls the patient's cheek laterally to manually support the nasal valve; if breathing improves significantly with this maneuver, nasal valve collapse is likely contributing. A Breathe Right strip trial at home is another low-tech confirmation."),
    h('Procedure'),
    li('Topical anesthetic — lidocaine-soaked pledgets placed for 10 minutes; followed by local injection of 1% or 2% lidocaine with epinephrine at treatment sites'),
    li('The Vivaer wand is positioned at the internal nasal valve — upper lateral cartilage region'),
    li('RF energy delivered in controlled pulses, typically 3–5 spots per side'),
    li('Patient feels warmth or mild pressure; should not be painful with adequate anesthesia'),
    li('Total time 15–20 minutes; patient leaves same day'),
    h('Post-procedure'),
    p('Mild swelling and crusting for a few days. Saline spray. Full results at 4–6 weeks.'),
    h('Insurance'),
    info('Not covered by commercial insurance. Covered by Medicare. Patients must be informed of out-of-pocket cost before the procedure is scheduled.'),
    warn('Confirm the disposable Vivaer wand is in stock before the patient arrives — this is a per-case cost item and the procedure cannot proceed without it.'),
  ],
  related: ['rhinaer', 'ma-vivaer', 'septoplasty'],
});

entries.push({
  id: 'rhinaer',
  type: 'proc',
  region: 'nose',
  title: 'RhinAer',
  desc: 'In-office radiofrequency treatment for vasomotor rhinitis, targeting the posterior nasal nerve.',
  blocks: [
    p('RhinAer (Aerin Medical) treats vasomotor rhinitis — chronic runny nose, congestion, and postnasal drip driven by parasympathetic hypersecretion — by targeting the posterior nasal nerve, a branch of the vidian nerve that carries parasympathetic fibers to the nasal mucosa.'),
    h('Mechanism'),
    p('RF energy is delivered along the posterior inferior turbinate where the posterior nasal nerve runs. The controlled thermal injury disrupts the parasympathetic signaling responsible for excess mucus production and mucosal engorgement. The effect is functionally similar to a surgical vidian neurectomy but done in-office and far less invasive. Best results are in non-allergic (vasomotor) rhinitis — patients whose rhinorrhea and congestion are nerve-mediated rather than IgE-driven. Allergy workup should be completed before RhinAer to confirm the picture.'),
    h('Procedure'),
    li('Same anesthesia setup as Vivaer — topical lidocaine pledgets then local lidocaine with epinephrine'),
    li('RhinAer wand positioned along the posterior inferior turbinate'),
    li('RF pulses delivered along the treatment path'),
    li('15–20 minutes; outpatient'),
    warn('<strong>Critical distinction to keep clear:</strong> Vivaer treats structural valve collapse causing obstruction. RhinAer treats nerve-mediated secretion causing rhinorrhea and drip. These are different problems requiring different wands. Some patients have both and undergo both procedures in the same session — always confirm which procedure or combination is scheduled and ensure the correct wands are available before the patient arrives.'),
    h('Insurance'),
    info('Not covered by commercial insurance. Covered by Medicare.'),
    h('Post-procedure'),
    p('Mild crusting and swelling, saline spray, results develop over weeks.'),
  ],
  related: ['vivaer', 'ma-vivaer', 'allergic-rhinitis'],
});

entries.push({
  id: 'steroid-inj',
  type: 'proc',
  region: 'nose',
  title: 'Steroid Injection — Intramuscular (Kenalog and Decadron)',
  desc: 'IM injection of corticosteroids (triamcinolone or dexamethasone) into the gluteal muscle for severe allergic disease, polyps, or perioperative inflammation.',
  blocks: [
    p('These are administered as intramuscular (IM) injections into the gluteal (buttock) muscle — not intranasally.'),
    h('Triamcinolone acetonide (Kenalog-40, 40 mg/mL)'),
    p('<strong>Triamcinolone acetonide (Kenalog-40, 40 mg/mL)</strong> is a long-acting depot corticosteroid used for patients with significant allergic disease, nasal polyps, or severe inflammatory flares where a sustained steroid effect over weeks is needed. The depot effect provides anti-inflammatory action for 3–6 weeks — useful when oral steroids are not tolerated or when sustained release is preferable to a short burst.'),
    h('Dexamethasone (Decadron, 4 mg/mL)'),
    p('<strong>Dexamethasone (Decadron, 4 mg/mL)</strong> is a shorter-acting, water-soluble corticosteroid used IM or IV perioperatively to reduce postoperative edema, nausea, and inflammation. Also used in the office for acute inflammatory flares where rapid but not prolonged effect is desired.'),
    h('IM injection procedure (gluteal)'),
    li('Confirm the medication, dose, and concentration with the provider before drawing'),
    li('Needle: typically 1.5 inch, 21–23 gauge depending on patient body habitus'),
    li('Injection site: ventrogluteal (preferred) or dorsogluteal; clean with alcohol and allow to dry'),
    li('Aspirate before injecting — confirm no blood return'),
    li('Inject slowly, withdraw, apply pressure'),
    li('Document lot number, expiration date, injection site, and administering staff'),
    h('Systemic considerations'),
    warn('Both medications represent meaningful systemic steroid exposure. Diabetic patients must be warned — blood glucose can rise significantly for days to weeks, particularly with triamcinolone. Document all prior steroid injections regardless of specialty (dermatology, orthopedics, ophthalmology) because cumulative steroid burden matters.'),
  ],
  related: ['allergic-rhinitis', 'nasal-polyps', 'ma-steroid'],
});

// ============================================================================
// NOSE — MA PROTOCOLS
// ============================================================================

entries.push({
  id: 'ma-ct',
  type: 'ma',
  region: 'nose',
  title: 'MA Protocol: CT Sinuses',
  desc: 'MA workflow for ordering, retrieving, and preparing CT sinus imaging for surgical planning.',
  blocks: [
    h('Before ordering'),
    step('Confirm order is for CT paranasal sinuses WITHOUT contrast — not head CT, not with contrast, sinus-specific protocol only'),
    step('If image-guided surgery is planned — confirm IGS-compatible protocol with imaging facility before scheduling the scan (American Health Imaging offers IGS protocol; fine-cut acquisition approximately 20 seconds)'),
    step('Enter correct diagnosis code: J32.9 for chronic rhinosinusitis, J33.0 for nasal polyps'),
    step('Obtain prior authorization from insurance if required before the patient is scheduled'),
    h('Outside facility images'),
    step('Request DICOM files — not just the written report. Surgeon needs actual images; the report alone is not usable for surgical planning'),
    step("Load DICOM to EMR or image viewer before the patient's appointment"),
    step('If patient brings a disc — copy to system immediately and verify the files open correctly'),
    h('Before surgical planning visit'),
    step('Confirm CT is loaded and accessible in the EMR before the appointment time'),
    step('Flag if CT was done more than 6 months ago — provider may want updated imaging before proceeding with surgical planning'),
  ],
  related: ['ct-sinuses', 'fess', 'chronic-sinusitis'],
});

entries.push({
  id: 'ma-cautery',
  type: 'ma',
  region: 'nose',
  title: 'MA Protocol: Nasal Cauterization Setup',
  desc: 'MA setup checklist for chemical and electrical cautery procedures and patient discharge instructions.',
  blocks: [
    h('Room setup — chemical cautery'),
    step('Consent form signed before procedure begins'),
    step('Silver nitrate sticks on tray (75% silver nitrate applicator)'),
    step('Topical anesthetic ready — lidocaine or tetracaine on cotton pledgets'),
    step('1% or 2% lidocaine with epinephrine 1:100,000 drawn and labeled'),
    step('Surgicel cut to 1.5 cm × 1.5 cm — mupirocin ointment applied to one side'),
    step('Good lighting confirmed; suction available if active bleeding'),
    step('Emesis bag within reach'),
    h('Room setup — electrical cautery'),
    step('Electrocautery unit located and powered on — test before provider enters room'),
    step('Grounding pad placed on patient back or thigh (monopolar only)'),
    step('Nasal endoscope available and scope light working'),
    h('Post-procedure instructions to give patient'),
    step('No nose blowing for 24–48 hours'),
    step('No nose picking'),
    step('Nasal gel spray to keep area moist'),
    step('No strenuous activity, massage, or chiropractic manipulation'),
  ],
  related: ['cauterization', 'epistaxis'],
});

entries.push({
  id: 'ma-vivaer',
  type: 'ma',
  region: 'nose',
  title: 'MA Protocol: Vivaer / RhinAer Setup',
  desc: 'MA setup checklist for Vivaer and RhinAer in-office radiofrequency procedures.',
  blocks: [
    warn('<strong>Critical first step:</strong> Confirm which procedure or combination is scheduled — Vivaer, RhinAer, or both. They require different wands. Do not assume.'),
    h('Day before or morning of'),
    step('Confirm correct disposable wand(s) are in stock: Vivaer wand and/or RhinAer wand. These are per-case cost items — no wand means the procedure cannot proceed'),
    step('Confirm Aerin console is charged and powers on'),
    h('Room setup'),
    step('Lidocaine-soaked pledgets prepared for topical anesthesia'),
    step('1% or 2% lidocaine with epinephrine drawn for local injection'),
    step('Place pledgets — start 10-minute timer before provider enters room'),
    step('Patient seated in chair in comfortable reclined position'),
    h('Post-procedure instructions to give patient'),
    step('Saline spray beginning today, several times daily'),
    step('Mild swelling and crusting for a few days — expected and normal'),
    step('Full results take 4–6 weeks — advise patient not to judge outcome immediately'),
    step('Schedule follow-up appointment before patient leaves'),
  ],
  related: ['vivaer', 'rhinaer'],
});

entries.push({
  id: 'ma-steroid',
  type: 'ma',
  region: 'nose',
  title: 'MA Protocol: Steroid Injection (IM)',
  desc: 'MA workflow for IM steroid injection including verification, technique, and documentation.',
  blocks: [
    step('Confirm medication, dose, and concentration verbally with provider — Kenalog-40 (40 mg/mL) and Decadron (4 mg/mL) are different agents with very different durations of action'),
    step('Check vial: medication name, concentration, lot number, expiration date'),
    step('Draw correct dose using 1.5 inch, 21–23 gauge needle appropriate to patient body habitus'),
    step('Ask about allergies and prior steroid injections from any specialty'),
    step('Ask if patient is diabetic — counsel that blood glucose may rise significantly for days to weeks with triamcinolone'),
    step('Position patient for ventrogluteal or dorsogluteal access'),
    step('Clean site with alcohol — allow to fully dry before injection'),
    step('Aspirate before injecting — confirm no blood return'),
    step('Inject slowly, withdraw, apply pressure with gauze'),
    step('Document: medication, dose, concentration, lot number, expiration, injection site, administering staff, and time'),
  ],
  related: ['steroid-inj'],
});

// ============================================================================
// EAR — DIAGNOSES
// ============================================================================

entries.push({
  id: 'ssnhl',
  type: 'dx',
  region: 'ear',
  title: 'Sudden Sensorineural Hearing Loss (SSNHL)',
  desc: 'Unexplained sensorineural hearing loss of at least 30 dB across three consecutive frequencies within 72 hours — a medical urgency.',
  blocks: [
    warn('<strong>This is a medical urgency.</strong> Recognize it and act on it immediately.'),
    h('Definition'),
    p('Unexplained sensorineural hearing loss of at least 30 dB across three consecutive frequencies, occurring within 72 hours. Almost always unilateral.'),
    h('Why it matters'),
    p('SSNHL is most often idiopathic but causes include viral cochleitis, microvascular event, autoimmune disease, and — in about 1–2% of cases — acoustic neuroma (vestibular schwannoma). Without treatment, roughly one-third of patients recover spontaneously, one-third recover partially, and one-third have permanent loss. The treatment window is approximately 2–4 weeks from onset. After that, steroids are unlikely to change the outcome.'),
    warn('When a patient calls reporting sudden hearing loss in one ear — regardless of how they describe it, whether "my ear went out," "everything sounds muffled," or "I woke up deaf in one ear" — do not schedule them for a routine appointment weeks out. Get the provider on the line before that patient hangs up.'),
    h('Workup'),
    li('Audiogram — pure tone thresholds, word recognition score, tympanogram to rule out middle ear effusion as the cause, acoustic reflexes'),
    li('MRI brain with IAC protocol and gadolinium — required in all cases to rule out acoustic neuroma; this is not optional even when hearing recovers fully. Recovery on steroids alone does not rule out a structural lesion — an acoustic neuroma can produce a temporary steroid-responsive pattern'),
    li('Labs: CBC, comprehensive metabolic panel, RPR, ANA, ESR; Lyme titers in endemic areas'),
    h('Treatment'),
    li('Oral prednisone — first-line; high-dose course (72 pills) with taper'),
    li('Repeat audiogram approximately one week after completing the prednisone course'),
    li('Intratympanic dexamethasone — used when oral steroids are contraindicated (diabetes, immunocompromised) or as salvage after incomplete recovery; series of 3–4 weekly injections with audiogram after the series'),
  ],
  related: ['it-injection', 'ma-ssnhl', 'audiogram-tympanogram'],
});

entries.push({
  id: 'bppv',
  type: 'dx',
  region: 'ear',
  title: 'BPPV and Vertigo',
  desc: 'Benign Paroxysmal Positional Vertigo — brief, intense spinning triggered by position change, caused by displaced otoliths in the semicircular canals.',
  blocks: [
    p('Vertigo is the false sensation of movement — the patient feels that they, or the world around them, is spinning when neither is actually moving. It is not dizziness in the vague sense, and the distinction matters when rooming patients. A patient who says "I feel dizzy" needs to be asked specifically: does the room spin, or do you feel lightheaded and unsteady? Spinning is vertigo. Lightheadedness without spinning is more likely presyncope, orthostatic hypotension, or anxiety.'),
    h('Peripheral vs. central vertigo — the key distinction'),
    p('Peripheral vertigo comes from the labyrinth (inner ear) or the vestibular nerve. It tends to be intense, often triggered by position change, associated with nausea and vomiting, and has accompanying nystagmus that follows predictable rules. The patient is miserable but neurologically intact.'),
    p('Central vertigo comes from the brainstem or cerebellum. It may be less intense than peripheral vertigo but is more dangerous. Red flags requiring immediate escalation: new onset headache with vertigo, diplopia, dysphagia, dysarthria, facial numbness, limb ataxia, inability to walk, or any frank neurological deficit. Nystagmus in central vertigo does not follow predictable peripheral rules — it may be purely vertical, direction-changing, or not suppressed by visual fixation.'),
    warn('<strong>Central vertigo red flags requiring immediate escalation:</strong> new onset headache with vertigo, diplopia, dysphagia, dysarthria, facial numbness, limb ataxia, inability to walk, or any frank neurological deficit.'),
    h('BPPV'),
    p('Benign Paroxysmal Positional Vertigo is the most common cause of vertigo seen in ENT. It is caused by otoliths — calcium carbonate crystals that normally sit on the otolith membrane in the utricle — becoming dislodged and migrating into one of the three semicircular canals. When the head moves, these free-floating crystals move within the canal fluid and generate an abnormal signal to the brain, producing a brief but intense spinning sensation.'),
    p('The posterior canal is affected in approximately 85–90% of BPPV cases. Horizontal canal BPPV accounts for most of the remaining cases. Anterior canal BPPV is rare.'),
    p('Symptoms: brief, intense spinning triggered by specific position changes — lying down, rolling in bed, looking up, or bending forward. Episodes last seconds to under a minute. Between episodes the patient feels completely normal or mildly unsteady. There is no hearing loss, no tinnitus, and no neurological symptoms in uncomplicated BPPV. If any of those are present, the diagnosis needs reassessment.'),
    p('BPPV is common after head trauma (even minor), after prolonged bed rest, after inner ear infection, in osteoporosis, and increasingly with age. It frequently resolves spontaneously but recurs in roughly 50% of patients over 5 years.'),
  ],
  related: ['dix-hallpike', 'epley', 'ma-epley', 'vestibular-neuritis'],
});

entries.push({
  id: 'meniere',
  type: 'dx',
  region: 'ear',
  title: "Ménière's Disease",
  desc: 'Endolymphatic hydrops — chronic relapsing inner ear disorder with episodic vertigo, fluctuating SNHL, tinnitus, and aural fullness.',
  blocks: [
    p("Ménière's disease is caused by endolymphatic hydrops — excess fluid accumulation in the membranous labyrinth of the inner ear, causing distension of the endolymphatic compartment. It is a chronic, relapsing condition with no cure — management is aimed at reducing attack frequency and severity and preserving hearing."),
    h('The classic tetrad'),
    li('Episodic vertigo — attacks lasting 20 minutes to several hours, distinguishing it from BPPV (seconds) and vestibular neuritis (days)'),
    li('Fluctuating sensorineural hearing loss — characteristically worse in the low frequencies early in the disease'),
    li('Tinnitus — often low-pitched, roaring quality, worsens before and during attacks'),
    li('Aural fullness — a pressure or stuffed sensation in the affected ear'),
    p('Not all four are present in every patient, particularly early in the disease. Diagnosis is clinical, supported by audiometric documentation of low-frequency SNHL.'),
    h('Triggers'),
    p('High-sodium diet, caffeine, alcohol, stress, poor sleep, barometric pressure changes, and hormonal fluctuation in women. Dietary triggers are real and counseling patients on this is part of management.'),
    h('Medical management'),
    li('Low-sodium diet — typically less than 1500–2000 mg per day; this is the cornerstone of conservative management and patients need specific dietary counseling, not just a verbal instruction to "watch the salt"'),
    li('Diuretics — hydrochlorothiazide or acetazolamide to reduce endolymph volume'),
    li('Vestibular suppressants for acute attacks — meclizine (Antivert), diazepam, or promethazine; for symptomatic relief only — do not use chronically as they inhibit vestibular compensation'),
    li('Betahistine — widely used in Europe, limited FDA approval in the US'),
    li('Intratympanic dexamethasone — for attack frequency reduction and hearing preservation'),
    h('Procedural management when medical therapy fails'),
    li('Meniett device — low-pressure pulse generator applied to a ventilation tube; requires a patent PE tube'),
    li('Endolymphatic sac decompression — hearing-preserving surgery with variable long-term efficacy'),
    li('Vestibular nerve section — cuts the vestibular nerve while preserving the cochlear nerve and hearing; highly effective for vertigo control but requires neurotologic-neurosurgical collaboration'),
    li('Labyrinthectomy — surgical destruction of the inner ear; eliminates both hearing and vestibular function; reserved for patients with no serviceable hearing in the affected ear'),
    li('Intratympanic gentamicin (chemical labyrinthectomy) — not performed at our practice'),
    h('Long-term course'),
    p("Ménière's is progressive. Over years, the fluctuating hearing loss becomes a fixed permanent loss. The vertigo attacks often burn out in late-stage disease, but the patient is left with permanent hearing loss, chronic tinnitus, and sometimes disequilibrium. Bilateral involvement occurs in 30–50% of patients over time."),
  ],
  related: ['it-injection', 'ma-it', 'audiogram-tympanogram', 'ttube'],
});

entries.push({
  id: 'vestibular-neuritis',
  type: 'dx',
  region: 'ear',
  title: 'Vestibular Neuritis and Labyrinthitis',
  desc: 'Acute inflammation of the vestibular nerve (neuritis) or the entire labyrinth (labyrinthitis) — typically post-viral.',
  blocks: [
    p('Vestibular neuritis is acute inflammation of the vestibular nerve, most commonly following a viral illness. Labyrinthitis is the same process but also involving the cochlea — it produces accompanying hearing loss and tinnitus in addition to vertigo.'),
    h('Symptoms'),
    p('Sudden onset of severe, continuous vertigo lasting days to weeks. Nausea and vomiting are often severe in the first 24–48 hours. The patient typically cannot walk without support acutely. There is no ear pain, no neurological deficit, and no headache — if any of those are present, consider central cause. The vertigo gradually improves over days as the brain compensates for the asymmetric vestibular input (central compensation).'),
    h('Treatment'),
    li('Vestibular suppressants short-term only — meclizine, diazepam, ondansetron for nausea; tapered off within a few days as they slow central compensation'),
    li('Oral corticosteroids — methylprednisolone or prednisone; may improve recovery if started within the first week'),
    li('Vestibular rehabilitation therapy (VRT) — the most important long-term treatment; referral to vestibular physical therapy is indicated once acute symptoms begin to settle'),
    warn('Meclizine should not continue past a few days. Patients with vestibular neuritis are often initially seen in the ED and arrive in ENT during the recovery phase asking why they still feel unsteady weeks later. The answer is that central compensation takes weeks to months and is accelerated by activity and vestibular rehabilitation — not by continued meclizine, which actively delays recovery by suppressing the signals the brain needs to recalibrate. Patients still on meclizine at four weeks need this conversation.'),
  ],
  related: ['bppv', 'meniere'],
});

entries.push({
  id: 'scd',
  type: 'dx',
  region: 'ear',
  title: 'Superior Canal Dehiscence (SCD)',
  desc: 'Thinning or absence of bone overlying the superior semicircular canal, creating an abnormal third mobile window into the inner ear.',
  blocks: [
    p('Superior canal dehiscence is a thinning or absence of the bone overlying the superior (anterior) semicircular canal, creating an abnormal third mobile window into the inner ear. Relatively rare but increasingly recognized as CT imaging becomes more common.'),
    h('Symptoms'),
    p('Sound-induced vertigo (Tullio phenomenon) — patients feel dizzy or off-balance in response to loud sounds, their own voice, or straining. Autophony — hearing their own voice, heartbeat, or eye movements abnormally loudly. Low-frequency conductive hearing loss on audiogram despite a normal-looking tympanic membrane and middle ear. This combination — conductive loss with normal tympanogram and normal otoscopy — is a SCD red flag.'),
    note('Conductive loss with normal tympanogram and normal otoscopy is a SCD red flag.'),
    h('Diagnosis'),
    p('High-resolution CT of the temporal bones with dedicated temporal bone protocol and fine cuts; not standard sinus CT. Dehiscence is often best seen on coronal reformats. VEMP testing (vestibular evoked myogenic potentials) shows abnormally low thresholds on the affected side.'),
    h('Treatment'),
    p('Conservative for mild symptoms — avoiding triggers, reassurance. Surgical repair (middle fossa craniotomy or transmastoid approach to resurface or plug the canal) for disabling symptoms.'),
  ],
  related: ['audiogram-tympanogram', 'meniere'],
});

// ============================================================================
// EAR — PROCEDURES
// ============================================================================

entries.push({
  id: 'audiogram-tympanogram',
  type: 'proc',
  region: 'ear',
  title: 'Reading an Audiogram and Tympanogram',
  desc: 'Reference for interpreting audiograms and tympanograms — types of hearing loss, symbols, frequency patterns, and tympanogram curves.',
  blocks: [
    h('The audiogram'),
    p("An audiogram is a graph that plots a patient's hearing thresholds — the softest sounds they can detect — across a range of frequencies. Understanding how to read one is essential in ENT because nearly every ear patient will have one in their chart, and the provider will reference it constantly during the visit."),
    p('The axes: Frequency (pitch) runs along the horizontal axis from low frequencies on the left (250 Hz) to high on the right (8000 Hz). Intensity (loudness) runs along the vertical axis in decibels hearing level (dB HL), with softer sounds at the top and louder sounds toward the bottom. Normal hearing thresholds fall between 0 and 25 dB HL. Any threshold below that line means the patient needs more sound intensity to detect that frequency — that is hearing loss.'),
    h('The symbols'),
    li('Right ear air conduction: O (circle), plotted in red'),
    li('Left ear air conduction: X, plotted in blue'),
    li('Right ear bone conduction: < (bracket), plotted in red'),
    li('Left ear bone conduction: > (bracket), plotted in blue'),
    p('Air conduction tests the entire hearing pathway. Bone conduction bypasses the outer and middle ear and stimulates the cochlea directly. The comparison between air and bone conduction thresholds tells you where the hearing loss originates.'),
    h('Types of hearing loss'),
    p("<strong>Conductive hearing loss</strong> — the problem is in the outer or middle ear. The cochlea is normal. On the audiogram: bone conduction is normal (0–25 dB), air conduction is elevated, creating an air-bone gap. A gap of 15 dB or more is significant. Common causes: cerumen impaction, otitis media with effusion, tympanic membrane perforation, ossicular discontinuity, otosclerosis (Carhart's notch at 2000 Hz), cholesteatoma."),
    p('<strong>Sensorineural hearing loss (SNHL)</strong> — the problem is at the cochlea or auditory nerve. On the audiogram: both air and bone conduction are equally elevated with no significant gap. The shape of the loss matters:'),
    li('High-frequency sloping loss — classic presbycusis and noise-induced hearing loss pattern'),
    li("Flat loss — seen in SSNHL, autoimmune inner ear disease, some Ménière's"),
    li("Low-frequency loss — classic early Ménière's, uncommon, should immediately prompt suspicion for endolymphatic hydrops"),
    li('4000 Hz notch — hallmark of noise-induced hearing loss (NIHL)'),
    p("Common causes: presbycusis, noise-induced, SSNHL, Ménière's, acoustic neuroma (often with disproportionately poor word recognition score), ototoxicity (aminoglycosides, cisplatin, loop diuretics)."),
    p('<strong>Mixed hearing loss</strong> — both conductive and sensorineural components present. Bone conduction is elevated but air conduction is even further elevated. Seen in advanced chronic otitis media or late-stage otosclerosis.'),
    h('Word recognition score (WRS)'),
    p("A percentage reflecting the patient's ability to understand speech at comfortable loudness. Normal is 90–100%. Poor WRS out of proportion to pure tone thresholds is a red flag for retrocochlear pathology — acoustic neuroma classically produces this mismatch. A score below 50% suggests the nerve is too damaged for amplification to be meaningfully helpful."),
    h('The tympanogram'),
    p('The tympanogram measures compliance (mobility) of the tympanic membrane and middle ear system as air pressure is varied in the sealed ear canal. It tests middle ear function, not hearing.'),
    li('<strong>Type A — Normal:</strong> Peak near 0 daPa, compliance 0.3–1.6 mL'),
    li('<strong>Type As — Stiffness:</strong> Peak at 0 daPa but shallow (&lt; 0.3 mL). Seen in otosclerosis and tympanosclerosis'),
    li('<strong>Type Ad — Hypermobility:</strong> Peak at 0 daPa but abnormally tall (&gt; 1.6 mL). Seen in ossicular discontinuity'),
    li('<strong>Type B — Flat:</strong> No peak at all. Causes: middle ear effusion (small ear canal volume), tympanic membrane perforation (large ear canal volume &gt; 2.0 mL), or impacted cerumen blocking the probe'),
    li('<strong>Type C — Negative pressure:</strong> Peak shifted left, more negative than -100 daPa. The eardrum is being sucked inward. This is the tympanogram of eustachian tube dysfunction. Left untreated, Type C evolves toward Type B as effusion develops'),
    note('The ear canal volume number distinguishes effusion from perforation in a Type B curve: small volume (&lt; 1.5 mL) = effusion, large volume (&gt; 2.0 mL) = perforation.'),
  ],
  related: ['ssnhl', 'meniere', 'scd'],
});

// ============================================================================
// PRESERVE EXISTING CONTENT — entries where the pasted source was truncated.
// We add the region field but keep the existing blocks intact.
// ============================================================================

const PRESERVE_REGION = {
  // dir/file → region
  'procedures/it-injection.json': { region: 'ear', related: ['ssnhl', 'meniere', 'ma-it'] },
  'procedures/ttube.json': { region: 'ear', related: ['meniere', 'ma-preop'] },
  'procedures/dix-hallpike.json': { region: 'ear', related: ['bppv', 'epley', 'ma-epley'] },
  'procedures/epley.json': { region: 'ear', related: ['bppv', 'dix-hallpike', 'ma-epley'] },
  'protocols/ma-ssnhl.json': { region: 'ear', related: ['ssnhl', 'it-injection'] },
  'protocols/ma-it.json': { region: 'ear', related: ['it-injection', 'ssnhl', 'meniere'] },
  'protocols/ma-epley.json': { region: 'ear', related: ['epley', 'dix-hallpike', 'bppv'] },
  'protocols/ma-preop.json': { region: 'general', related: ['fess', 'septoplasty', 'ttube'] },
};

// ============================================================================
// WRITE FILES
// ============================================================================

async function main() {
  for (const dir of Object.values(DIRS)) {
    await fse.ensureDir(path.join(DATA_DIR, dir));
  }

  const newIds = new Set(entries.map(e => e.id));
  let written = 0;

  // Write fresh entries
  for (const e of entries) {
    const dir = DIRS[e.type];
    const file = path.join(DATA_DIR, dir, `${e.id}.json`);
    const full = {
      id: e.id,
      type: e.type,
      region: e.region,
      title: e.title,
      desc: e.desc,
      blocks: e.blocks,
      related: e.related || [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    await fse.writeJson(file, full, { spaces: 2 });
    written++;
  }

  // Preserve existing files (add region + updated related)
  for (const [relPath, meta] of Object.entries(PRESERVE_REGION)) {
    const file = path.join(DATA_DIR, relPath);
    if (!(await fse.pathExists(file))) {
      console.warn(`Preserved file missing: ${relPath}`);
      continue;
    }
    const data = await fse.readJson(file);
    data.region = meta.region;
    if (meta.related && (!data.related || data.related.length === 0)) {
      data.related = meta.related;
    } else if (meta.related) {
      // merge unique
      const merged = new Set([...(data.related || []), ...meta.related]);
      data.related = [...merged];
    }
    if (!data.createdAt) data.createdAt = NOW;
    data.updatedAt = NOW;
    await fse.writeJson(file, data, { spaces: 2 });
    written++;
  }

  // Validate every JSON file in the data tree
  let total = 0;
  for (const dir of Object.values(DIRS)) {
    const dirPath = path.join(DATA_DIR, dir);
    const files = await fse.readdir(dirPath);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const filePath = path.join(dirPath, f);
      try {
        const data = await fse.readJson(filePath);
        if (!data.id || !data.type || !data.title) {
          console.warn(`Missing required field: ${f}`);
        }
        if (!data.region) {
          console.warn(`Missing region: ${f}`);
        }
        total++;
      } catch (err) {
        console.error(`Invalid JSON: ${filePath} — ${err.message}`);
      }
    }
  }

  console.log(`\nWrote/updated ${written} entries.`);
  console.log(`Total valid JSON files in data tree: ${total}`);
  console.log(`\nBy region:`);
  const byRegion = { nose: 0, ear: 0, general: 0 };
  for (const dir of Object.values(DIRS)) {
    const files = await fse.readdir(path.join(DATA_DIR, dir));
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const data = await fse.readJson(path.join(DATA_DIR, dir, f));
      byRegion[data.region] = (byRegion[data.region] || 0) + 1;
    }
  }
  for (const [r, c] of Object.entries(byRegion)) {
    console.log(`  ${r}: ${c}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
