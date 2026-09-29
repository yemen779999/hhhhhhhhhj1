const fs = require('fs');
let code = fs.readFileSync('src/components/QuickEntryModal.tsx', 'utf8');

code = code.replace(/const \[restrictionToast, setRestrictionToast\] = useState.*?;/, `const [restrictionModal, setRestrictionModal] = useState({ open: false, message: '' });`);
code = code.replace(/setRestrictionToast\({ show: false, message: '' }\);/g, `setRestrictionModal({ open: false, message: '' });`);
code = code.replace(/setRestrictionToast\({ show: true, message: '.*?' }\);/g, `setRestrictionModal({ open: true, message: 'لقد وصلت للحد الأقصى للعمليات اليومية في هذه النسخة. اشترك في النسخة العادية للعمليات اللامحدودة!' });`);

const toastRegex = /<Toast\s+show=\{restrictionToast\.show\}\s+message=\{restrictionToast\.message\}\s+onClose=\{\(\) => setRestrictionToast\(\{ \.\.\.restrictionToast, show: false \}\)\}\s+actionLabel="ترقية الآن"\s+onAction=\{\(\) => \{\s+setRestrictionToast\(\{ \.\.\.restrictionToast, show: false \}\);\s+onClose\(\);\s+onNavigateToSubscription\?\.\(\);\s+\}\}\s+\/>/gs;

const replacement = `<ProRestrictionModal 
        isOpen={restrictionModal.open}
        onClose={() => setRestrictionModal({ ...restrictionModal, open: false })}
        message={restrictionModal.message}
        onUpgrade={() => {
          setRestrictionModal({ ...restrictionModal, open: false });
          onClose();
          onNavigateToSubscription?.();
        }}
      />`;

code = code.replace(toastRegex, replacement);
fs.writeFileSync('src/components/QuickEntryModal.tsx', code);
