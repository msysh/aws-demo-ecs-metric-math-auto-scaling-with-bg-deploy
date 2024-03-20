import * as cdk from 'aws-cdk-lib';
import {
  aws_codepipeline as codepipeline,
  aws_iam as iam,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { Source } from './pipeline-stages/source';
import { BuildApp } from './pipeline-stages/build-app';
import { BuildImage } from './pipeline-stages/build-image';
import { DeployEcsBlueGreen } from './pipeline-stages/deploy-ecs-bg';
import { IWorkload } from './workload';

export interface PipelineStackProps {
  workload: IWorkload;
}

export class Pipeline extends Construct {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id);

    const PROJECT_BASE_NAME = props.workload.ecsService.serviceName;
    const workload: IWorkload = props.workload;

    // -----------------------------
    // S3 (for Artifact store)
    // -----------------------------
    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket');

    const source = new Source(this, {
      projectBaseName: PROJECT_BASE_NAME,
    });

    const buildApp = new BuildApp(this, {
      projectBaseName: PROJECT_BASE_NAME,
      artifactBucket: artifactBucket,
      repository: source.repository,
      sourceOutput: source.output,
    });

    const buildImage = new BuildImage(this, {
      projectBaseName: PROJECT_BASE_NAME,
      artifactBucket: artifactBucket,
      repository: source.repository,
      ecrRepository: workload.ecrRepository,
      sourceOutput: source.output,
      buildAppOutput: buildApp.output,
    });

    const deployEcs = new DeployEcsBlueGreen(this, {
      projectBaseName: PROJECT_BASE_NAME,
      blueTargetGroup: workload.blueTargetGroup,
      greenTargetGroup: workload.greenTargetGroup,
      prodListener: workload.prodListener,
      testListener: workload.testListener,
      service: workload.ecsService,
      sourceOutput: source.output,
      buildImageOutput: buildImage.output,
    });

    // -----------------------------
    // CodePipeline
    // -----------------------------

    // IAM Role for CodePipeline
    const pipelineRole = new iam.Role(this, 'RoleCodepipeline', {
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      description: `Role for CodePipeline of ${PROJECT_BASE_NAME}`,
    });

    // Pipeline
    const pipeline = new codepipeline.Pipeline(this, 'CodePipeline', {
      pipelineName: PROJECT_BASE_NAME,
      pipelineType: codepipeline.PipelineType.V1,
      artifactBucket: artifactBucket,
      role: pipelineRole,
      stages: [
        {
          stageName: 'Source',
          actions: [ source.action ]
        },
        {
          stageName: 'Build-App',
          actions: [ buildApp.action ]
        },
        {
          stageName: 'Build-Image',
          actions: [ buildImage.action ]
        },
        {
          stageName: 'Deploy',
          actions: [ deployEcs.action ]
        }
      ],
    });

    new cdk.CfnOutput(this, 'Output-ArtifactBucketName', {
      description: 'Artifact Bucket Name',
      value: artifactBucket.bucketName,
    });
  }
}