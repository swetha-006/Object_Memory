import React from 'react';
import { AlertCircle, Clock, CheckCircle, ShieldAlert } from 'lucide-react';

export function getWarrantyInfo(warrantyStr) {
  if (!warrantyStr || warrantyStr === 'Not recorded') {
    return { status: 'none', label: 'Not recorded', days: null, urgency: 'none' };
  }

  const match = warrantyStr.match(/\d{4}-\d{2}-\d{2}/);
  if (!match) {
    return { status: 'custom', label: warrantyStr, days: null, urgency: 'none' };
  }

  const expiry = new Date(match[0]);
  const diffDays = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'expired',
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      days: diffDays,
      urgency: 'expired',
      date: match[0]
    };
  }

  if (diffDays <= 30) {
    return {
      status: 'critical',
      label: `Expiring soon (${diffDays}d left)`,
      days: diffDays,
      urgency: 'critical',
      date: match[0]
    };
  }

  if (diffDays <= 90) {
    return {
      status: 'warning',
      label: `Expires in ${diffDays}d`,
      days: diffDays,
      urgency: 'warning',
      date: match[0]
    };
  }

  return {
    status: 'active',
    label: `Active (${match[0]})`,
    days: diffDays,
    urgency: 'active',
    date: match[0]
  };
}

export function WarrantyBadge({ warranty }) {
  const info = getWarrantyInfo(warranty);

  if (info.status === 'none') {
    return <span className="warrantyBadge badge-muted">No warranty logged</span>;
  }

  if (info.status === 'expired') {
    return (
      <span className="warrantyBadge badge-expired">
        <AlertCircle size={11} />
        {info.label}
      </span>
    );
  }

  if (info.status === 'critical') {
    return (
      <span className="warrantyBadge badge-critical">
        <ShieldAlert size={11} />
        {info.label}
      </span>
    );
  }

  if (info.status === 'warning') {
    return (
      <span className="warrantyBadge badge-warning">
        <Clock size={11} />
        {info.label}
      </span>
    );
  }

  return (
    <span className="warrantyBadge badge-active">
      <CheckCircle size={11} />
      {info.label}
    </span>
  );
}
