import { fetchPayerAccountSummary } from '@/lib/dataservice/accountPlan/payerAccountSummary';
import { loadPayerExecutiveSummary } from '@/lib/dataservice/accountPlan/payerExecutiveSummary';
import { loadPayerAccountLandscape } from '@/lib/dataservice/accountPlan/payerAccountLandscape';
import { loadPayerAssessments } from '@/lib/dataservice/accountPlan/payerAssessments';
import { loadPayerStakeholders } from '@/lib/dataservice/accountPlan/payerStakeholders';
import { loadPayerLaunchReadiness } from '@/lib/dataservice/accountPlan/payerLaunchReadiness';
import { loadPayerHierarchy } from '@/lib/dataservice/accountPlan/payerHierarchy';
import { loadPayerCriticalActions } from '@/lib/dataservice/accountPlan/payerCriticalActions';
import { loadPayerMilestones } from '@/lib/dataservice/accountPlan/payerMilestones';
import { loadPayerBarriersOpportunities } from '@/lib/dataservice/accountPlan/payerBarriersOpportunities';
import { createAccountPlanPresentation } from './accountPlanPptRenderer';
import { buildPayerAccountPlanSlides } from './payerAccountPlanPptSections';

export { deliverPreparedAccountPlanPpt as deliverPreparedPayerAccountPlanPpt } from './accountPlanPpt';

export async function loadPayerExportData(planId) {
  if (!planId) throw new Error('Select a Payer Account Plan before exporting.');
  const entries = await Promise.all(Object.entries({
    account: fetchPayerAccountSummary, summary: loadPayerExecutiveSummary, landscape: loadPayerAccountLandscape,
    assessments: loadPayerAssessments, stakeholders: loadPayerStakeholders, launch: loadPayerLaunchReadiness,
    hierarchy: loadPayerHierarchy, actions: loadPayerCriticalActions, milestones: loadPayerMilestones, issues: loadPayerBarriersOpportunities,
  }).map(async ([key, load]) => [key, await load()]));
  const data = Object.fromEntries(entries);
  if (entries.some(([key, value]) => key !== 'account' && value.planId !== planId)) throw new Error('The selected Account Plan changed. Reopen Export to try again.');
  return data;
}

export async function preparePayerAccountPlanPpt(planId) {
  const data = await loadPayerExportData(planId);
  const title = data.account.planName || `${data.account.accountName} Payer Account Plan`;
  const slides = buildPayerAccountPlanSlides(data);
  const presentation = createAccountPlanPresentation(slides, { title });
  const blob = await presentation.write({ outputType: 'blob' });
  if (!blob.size) throw new Error('The PowerPoint file could not be generated. Please try again.');
  const fileName = `${title.replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 120) || 'Payer-Account-Plan'}.pptx`;
  return { blob, title, fileName, slideCount: slides.length };
}
