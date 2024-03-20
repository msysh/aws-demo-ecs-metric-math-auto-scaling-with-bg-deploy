import * as cdk from 'aws-cdk-lib';
import { custom_resources as cr } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface AutoScalingProps {
  ecsService: cdk.aws_ecs.FargateService;
  blueTargetGroup: cdk.aws_elasticloadbalancingv2.ApplicationTargetGroup;
  greenTargetGroup: cdk.aws_elasticloadbalancingv2.ApplicationTargetGroup;
}

export class AutoScaling extends Construct {
  constructor (scope: Construct, id: string, props: AutoScalingProps){
    super(scope, id);

    const {
      stackName,
    } = new cdk.ScopedAws(this);

    const autoScalingPolicyName = `${stackName}--target-tracking`;

    const autoScaling = props.ecsService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    // Target Tracking Policy
    // ```
    // Error: Only direct metrics are supported for Target Tracking. Use Step Scaling or supply a Metric object.
    // ```
    // https://github.com/aws/aws-cdk/issues/20659
    // For now, it needs CFn support
    const targetTrackingScalingPolicyConfiguration = {
      TargetValue: 500,
      ScaleInCooldown: 120,
      CustomizedMetricSpecification: {
        Metrics: [
          {
            Id: 'tg1',
            Label: 'TargetGroup-1',
            MetricStat: {
              Metric: {
                Namespace: 'AWS/ApplicationELB',
                MetricName: 'RequestCountPerTarget',
                Dimensions: [
                  {
                    Name: 'TargetGroup',
                    Value: props.blueTargetGroup.targetGroupFullName,
                  }
                ]
              },
              Stat: 'Sum'
            },
            ReturnData: false
          },
          {
            Id: 'tg2',
            Label: 'TargetGroup-2',
            MetricStat: {
              Metric: {
                Namespace: 'AWS/ApplicationELB',
                MetricName: 'RequestCountPerTarget',
                Dimensions: [
                  {
                    Name: 'TargetGroup',
                    Value: props.greenTargetGroup.targetGroupFullName,
                  }
                ]
              },
              Stat: 'Sum'
            },
            ReturnData: false
          },
          {
            Id: 'e1',
            Label: 'SumRequestCountPerTarget',
            Expression: 'tg1 + tg2',
            ReturnData: true
          }
        ]
      }
    };

    // Auto Scaling policy
    const awsCustomResource = new cr.AwsCustomResource(this, 'TargetTrackingAutoScalingPolicy', {
      installLatestAwsSdk: false,
      logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
      onCreate: {
        service: 'ApplicationAutoScaling',
        action: 'putScalingPolicy',
        parameters: {
          ServiceNamespace: 'ecs',
          ScalableDimension: 'ecs:service:DesiredCount',
          ResourceId: `service/${props.ecsService.cluster.clusterName}/${props.ecsService.serviceName}`,
          PolicyName: autoScalingPolicyName,
          PolicyType: 'TargetTrackingScaling',
          TargetTrackingScalingPolicyConfiguration: targetTrackingScalingPolicyConfiguration,
        },
        physicalResourceId: cr.PhysicalResourceId.of(`${props.ecsService.cluster.clusterName}-${props.ecsService.serviceName}-autoScalingPolicyName`),
      },
      onUpdate: {
        service: 'ApplicationAutoScaling',
        action: 'putScalingPolicy',
        parameters: {
          ServiceNamespace: 'ecs',
          ScalableDimension: 'ecs:service:DesiredCount',
          ResourceId: `service/${props.ecsService.cluster.clusterName}/${props.ecsService.serviceName}`,
          PolicyName: autoScalingPolicyName,
          PolicyType: 'TargetTrackingScaling',
          TargetTrackingScalingPolicyConfiguration: targetTrackingScalingPolicyConfiguration,
        },
      },
      onDelete: {
        service: 'ApplicationAutoScaling',
        action: 'deleteScalingPolicy',
        parameters: {
          ServiceNamespace: 'ecs',
          ScalableDimension: 'ecs:service:DesiredCount',
          ResourceId: `service/${props.ecsService.cluster.clusterName}/${props.ecsService.serviceName}`,
          PolicyName: autoScalingPolicyName,
        },
        ignoreErrorCodesMatching: 'ObjectNotFoundException',
      },
      timeout: cdk.Duration.minutes(15),
    });
  }
}