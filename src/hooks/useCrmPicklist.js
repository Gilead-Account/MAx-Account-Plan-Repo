import { useEffect, useState } from 'react';
import { hasVeevaRuntime } from '@/lib/dataservice/client';
import { getCrmPicklistValueLabels, getPicklistValueLabels } from '@/lib/dataservice/query';
import { payerPicklistOptions } from '@/lib/dataservice/accountPlan/payerLaunchReadiness';

export default function useCrmPicklist(object, field) {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    let cancelled = false;
    setOptions([]);
    const read = hasVeevaRuntime() ? getCrmPicklistValueLabels : getPicklistValueLabels;
    read(object, field).then((labels) => {
      const values = payerPicklistOptions(labels);
      if (!cancelled) setOptions(values.length ? values : [{ value: '', label: `No CRM options for ${object}.${field}`, disabled: true }]);
    }).catch((error) => {
      console.error(`[picklist] Unable to load ${object}.${field}`, error);
      if (!cancelled) setOptions([{ value: '', label: error.message || 'Options unavailable — reopen to retry', disabled: true }]);
    });
    return () => { cancelled = true; };
  }, [object, field]);
  return options;
}
