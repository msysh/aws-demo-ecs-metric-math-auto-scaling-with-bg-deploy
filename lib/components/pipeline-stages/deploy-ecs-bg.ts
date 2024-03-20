import * as cdk from 'aws-cdk-lib';
import {
  aws_iam as iam,
  aws_codedeploy as codedeploy,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as actions,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DeployEcsBlueGreenProps {
  projectBaseName: string;
  blueTargetGroup: cdk.aws_elasticloadbalancingv2.ApplicationTargetGroup;
  greenTargetGroup: cdk.aws_elasticloadbalancingv2.ApplicationTargetGroup;
  prodListener: cdk.aws_elasticloadbalancingv2.IApplicationListener;
  testListener: cdk.aws_elasticloadbalancingv2.IApplicationListener;
  service: cdk.aws_ecs.IBaseService;
  sourceOutput: codepipeline.Artifact;
  buildImageOutput: codepipeline.Artifact;
}

export class DeployEcsBlueGreen {

  public readonly action: actions.CodeDeployEcsDeployAction;

  constructor (scope: Construct, props: DeployEcsBlueGreenProps){

    const PROJECT_BASE_NAME = props.projectBaseName;

    const policyDocument = new iam.PolicyDocument({
      statements:[
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject'
          ],
          resources: [
            `arn:aws:s3:::${props.buildImageOutput.bucketName}/*`,
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:ListBucket'
          ],
          resources: [
            'arn:aws:s3:::*'
          ],
        })
      ]
    });
    // IAM Role for CodeDeploy
    const role = new iam.Role(scope, 'RoleCodeDeploy', {
      assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
      description: 'Role for CodeDeploy',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSCodeDeployRole'),
      ],
      inlinePolicies: {
        'policy': policyDocument
      }
    });

    const deployment = new codedeploy.EcsDeploymentGroup(scope, 'EcsDeploymentGroup', {
      application: new codedeploy.EcsApplication(scope, 'EcsApplication', {
        applicationName: PROJECT_BASE_NAME
      }),
      autoRollback: {
        deploymentInAlarm: false,
        failedDeployment: false,
        stoppedDeployment: false,
      },
      deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
      blueGreenDeploymentConfig: {
        blueTargetGroup: props.blueTargetGroup,
        greenTargetGroup: props.greenTargetGroup,
        listener: props.prodListener,
        deploymentApprovalWaitTime: cdk.Duration.days(2), // Max 2 days
        testListener: props.testListener,
      },
      service: props.service,
      role: role,
    });

    // Action
    const action = new actions.CodeDeployEcsDeployAction({
      actionName: 'BlueGreenDeploy',
      deploymentGroup: deployment,
      appSpecTemplateFile: props.sourceOutput.atPath('appspec.yml'),
      taskDefinitionTemplateFile: props.sourceOutput.atPath('taskdef.json'),
      containerImageInputs: [
        {
          input: props.buildImageOutput,
          taskDefinitionPlaceholder: 'image_uri',
        },
      ]
    });

    this.action = action;
  }
}