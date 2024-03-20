import {
  aws_codecommit as codecommit,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as actions,
  CfnOutput,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface SourceProps {
  projectBaseName: string;
}

export class Source {

  public readonly repository: codecommit.IRepository;
  public readonly output: codepipeline.Artifact;
  public readonly action: actions.CodeCommitSourceAction;

  constructor (scope: Construct, props: SourceProps){

    const PROJECT_BASE_NAME = props.projectBaseName;

    // -----------------------------
    // CodeCommit
    // -----------------------------
    const repository = new codecommit.Repository(scope, 'Repository', {
      repositoryName: PROJECT_BASE_NAME,
      description: `Repository for ${PROJECT_BASE_NAME}`,
      // code: codecommit.Code.fromDirectory(
      //   '../assets/demo-app-repository',
      //   'main'
      // ),
    });

    // Artifact
    const output = new codepipeline.Artifact('Source');

    // Action
    const action = new actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      branch: 'main',
      repository: repository,
      output: output,
      codeBuildCloneOutput: false,
    });

    this.repository = repository;
    this.output = output;
    this.action = action;

    // -----------------------------
    // Output
    // -----------------------------
    new CfnOutput(scope, 'OutputCodeCommitRepositoryUrl', {
      value: repository.repositoryCloneUrlSsh
    });
    new CfnOutput(scope, 'OutputCodeCommitRepositoryUrlGrc', {
      value: repository.repositoryCloneUrlGrc
    });
  }
}