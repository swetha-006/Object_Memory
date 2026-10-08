import React, { useRef } from 'react';
import { Printer, X, ShieldCheck, FileText, Calendar, Tag, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

export function InsuranceDossierModal({ obj, user, onClose }) {
  const claimRef = `OM-CLAIM-${obj.id}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handlePrint = () => {
    window.print();
  };

  const damageEvents = (obj.events || []).filter(e =>
    ['damage', 'incident', 'condition'].includes(String(e.type).toLowerCase())
  );

  return (
    <div className="overlay dossierOverlay">
      <div className="modal dossierModal">
        <div className="dossierModalActions noPrint">
          <button className="btn primary" onClick={handlePrint}>
            <Printer size={15} />
            Print / Save PDF Dossier
          </button>
          <button className="iconBtn closeBtn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="dossierSheet printableDossier">
          {/* Header */}
          <div className="dossierHeader">
            <div className="dossierBrand">
              <span className="dossierLogoMark">O</span>
              <div>
                <h2>ObjectMemory Vault</h2>
                <span className="dossierSub">Verified Proof of Possession & Condition Dossier</span>
              </div>
            </div>
            <div className="dossierMeta">
              <div className="dossierRef">
                <small>OFFICIAL DOSSIER REF</small>
                <strong>{claimRef}</strong>
              </div>
              <div className="dossierDate">
                <small>ISSUED ON</small>
                <span>{generatedDate}</span>
              </div>
            </div>
          </div>

          <div className="dossierNotice">
            <ShieldCheck size={16} />
            <span>
              This certified document is generated from private immutable timestamped records in the ObjectMemory vault for submission to insurers, assessors, or warranty administrators.
            </span>
          </div>

          {/* Section: Insured & Asset Overview */}
          <div className="dossierGrid">
            <div className="dossierCard">
              <div className="dossierSectionTitle">1. POLICYHOLDER & OWNER DETAILS</div>
              <div className="dossierField">
                <small>Registered Owner</small>
                <b>{user?.name || 'Verified Account'}</b>
              </div>
              <div className="dossierField">
                <small>Verified Account Email</small>
                <span>{user?.email || 'N/A'}</span>
              </div>
              <div className="dossierField">
                <small>Record Custody</small>
                <span>Local Encrypted SQLite Storage</span>
              </div>
            </div>

            <div className="dossierCard">
              <div className="dossierSectionTitle">2. POSSESSION IDENTIFICATION</div>
              <div className="dossierField">
                <small>Item Title & Designation</small>
                <b>{obj.title}</b>
              </div>
              <div className="dossierField">
                <small>Brand / Make & Model</small>
                <span>{obj.brand || 'N/A'} {obj.model || ''}</span>
              </div>
              <div className="dossierField">
                <small>Serial / Identification Number</small>
                <b className="serialHighlight">{obj.serial || 'Not recorded'}</b>
              </div>
            </div>
          </div>

          {/* Section: Valuation & Condition */}
          <div className="dossierSpecs">
            <div className="dossierSpec">
              <small>Category</small>
              <b>{obj.category}</b>
            </div>
            <div className="dossierSpec">
              <small>Recorded Valuation</small>
              <b className="valHighlight">{obj.value ? `INR ${Number(obj.value).toLocaleString()}` : 'Not recorded'}</b>
            </div>
            <div className="dossierSpec">
              <small>Purchase Date</small>
              <b>{obj.purchase_date || 'Not recorded'}</b>
            </div>
            <div className="dossierSpec">
              <small>Current Condition Rating</small>
              <span className={`dossierConditionBadge cond-${(obj.condition || 'good').toLowerCase().replace(/\s+/g, '')}`}>
                {obj.condition || 'Good'}
              </span>
            </div>
            <div className="dossierSpec">
              <small>Warranty Status</small>
              <b>{obj.warranty || 'Not recorded'}</b>
            </div>
          </div>

          {/* Section: Visual Evidence */}
          <div className="dossierSection">
            <div className="dossierSectionTitle">3. PHOTOGRAPHIC VERIFICATION & ASSET STATE</div>
            <div className="dossierPhotos">
              <div className="dossierPhotoFrame">
                <small>PRIMARY ASSET PHOTO</small>
                {obj.imageUrl ? (
                  <img src={obj.imageUrl} alt={obj.title} crossOrigin="anonymous" />
                ) : (
                  <div className="dossierNoPhoto">No cover photo archived</div>
                )}
              </div>

              {damageEvents.filter(e => e.imageUrl).slice(0, 2).map((ev, i) => (
                <div key={ev.id || i} className="dossierPhotoFrame">
                  <small>INCIDENT EVIDENCE ({ev.title})</small>
                  <img src={ev.imageUrl} alt={ev.title} crossOrigin="anonymous" />
                </div>
              ))}
            </div>
          </div>

          {/* Section: Verified Lifecycle Audit Log */}
          <div className="dossierSection">
            <div className="dossierSectionTitle">4. VERIFIED TIMELINE & INCIDENT AUDIT LOG ({obj.events?.length || 0} Records)</div>
            <table className="dossierTable">
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>Date / Time</th>
                  <th style={{ width: '15%' }}>Record Type</th>
                  <th style={{ width: '25%' }}>Event Summary</th>
                  <th style={{ width: '15%' }}>Condition</th>
                  <th style={{ width: '30%' }}>Verified Notes</th>
                </tr>
              </thead>
              <tbody>
                {(obj.events || []).map((e) => (
                  <tr key={e.id}>
                    <td>{(e.occurred_at || e.created_at || '').slice(0, 10)}</td>
                    <td><span className="tableTypeTag">{e.type.toUpperCase()}</span></td>
                    <td><b>{e.title}</b></td>
                    <td>{e.condition || '—'}</td>
                    <td>{e.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section: Attached Documents Vault */}
          <div className="dossierSection">
            <div className="dossierSectionTitle">5. ATTACHED DOCUMENTS MANIFEST ({obj.documents?.length || 0} Files)</div>
            {obj.documents && obj.documents.length ? (
              <div className="dossierDocList">
                {obj.documents.map((d) => (
                  <div key={d.id} className="dossierDocItem">
                    <FileText size={14} />
                    <span><b>{d.original_name}</b> ({(d.size / 1024).toFixed(1)} KB)</span>
                    <small>Uploaded {d.created_at?.slice(0, 10)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dossierMuted">No document files attached to this record.</p>
            )}
          </div>

          {/* Certification Signature Block */}
          <div className="dossierSignBlock">
            <div className="dossierCertText">
              <b>Owner Certification:</b>
              <p>
                I hereby declare that the possession details, serial identifiers, condition changes, and invoices documented in this dossier are an accurate historical record extracted from my private ObjectMemory archive.
              </p>
            </div>
            <div className="dossierSignatureLine">
              <div className="sigLine"></div>
              <small>Authorized Signature & Date</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
