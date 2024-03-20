import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { Vpc } from './components/vpc';
import { Workload } from './components/workload';
import { AutoScaling } from './components/auto-scaling';
import { Pipeline } from './components/pipeline';

const ECS_SERVICE_NAME: string = 'demo-metric-math-target-tracking';

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'Vpc');

    const workload = new Workload(this, 'Workload', {
      vpc: vpc.vpc,
      defaultSecurityGroupId: vpc.defaultSecurityGroupId,
      ecsServiceName: ECS_SERVICE_NAME,
    });

    const autoScaling = new AutoScaling(this, 'AutoScaling', {
      ecsService: workload.ecsService,
      blueTargetGroup: workload.blueTargetGroup,
      greenTargetGroup: workload.greenTargetGroup,
    });

    const pipeline = new Pipeline(this, 'Pipeline', {
      workload: workload,
    });
  }
}
