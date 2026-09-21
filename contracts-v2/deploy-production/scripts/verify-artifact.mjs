import { stringify, verifyReviewedArtifact } from './deployment-lib.mjs';
const result = verifyReviewedArtifact();
console.log(stringify({ reviewedArtifactIdentity: result, status: result.matches ? 'PASS' : 'FAIL' }));
if (!result.matches) process.exitCode = 1;
