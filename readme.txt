public sealed class UnitOfWork : IUnitOfWork
    2 {
    3     private readonly DataConnectionTransaction _transaction;
    4     private readonly bool _isRootTransactionOwner; // Flag to track ownership
    5     private bool _committed = false;
    6
    7     public WorkflowDataConnection Connection { get; }
    8
    9     public UnitOfWork(WorkflowDataConnection connection)
   10     {
   11         Connection = connection;
   12
   13         // Check if a transaction is already active on this connection.
   14         if (Connection.Transaction == null)
   15         {
   16             // No active transaction. This instance is the "root" and will create one.
   17             _transaction = Connection.BeginTransaction();
   18             _isRootTransactionOwner = true;
   19         }
   20         else
   21         {
   22             // A transaction already exists. This instance will participate but not own it.
   23             _transaction = Connection.Transaction; // Get a reference to the existing transaction
   24             _isRootTransactionOwner = false;
   25         }
   26     }
   27
   28     public async Task<int> CommitAsync()
   29     {
   30         // Only the root owner of the transaction can issue a commit.
   31         if (!_isRootTransactionOwner)
   32         {
   33             // For a nested UoW, "committing" is a no-op. We just mark our own
   34             // state as committed to prevent a rollback in our DisposeAsync.
   35             _committed = true;
   36             return 0;
   37         }
   38
   39         // Original commit logic for the root UoW
   40         try
   41         {
   42             await _transaction.CommitAsync();
   43             _committed = true;
   44             return 1;
   45         }
   46         catch (Exception)
   47         {
   48             // If commit fails, the root owner must roll back.
   49             await _transaction.RollbackAsync();
   50             throw;
   51         }
   52     }
   53
   54     public async ValueTask DisposeAsync()
   55     {
   56         // Only the root owner is responsible for rollback on disposal.
   57         // A nested UoW failing should not roll back the entire parent transaction
   58         // unless the exception propagates up and causes the root to fail.
   59         if (_isRootTransactionOwner && !_committed)
   60         {
   61             await _transaction.RollbackAsync();
   62         }
   63
   64         // The root owner is also the only one that should dispose the transaction object.
   65         if (_isRootTransactionOwner)
   66         {
   67             await _transaction.DisposeAsync();
   68         }
   69         // We do not dispose the Connection, as it's managed by the DI container.
   70     }
   71 }

//
public interface IUnitOfWork : IAsyncDisposable
   4 {
   5     // Expose the connection so repositories can use it
   6     WorkflowDataConnection Connection { get; }
   7
   8     Task<int> CommitAsync();
   9 }

 public sealed class UnitOfWork : IUnitOfWork
    4 {
    5     private readonly DataConnectionTransaction _transaction;
    4     private bool _committed = false;
    6     public WorkflowDataConnection Connection { get; }
    9
   10   
   13
   14     public UnitOfWork(YourLinq2DbSettings settings, TelemetryHelper telemetryHelper)
   15     {
   16        Connection = connection;
   12         _transaction = Connection.BeginTransaction();
   19         _telemetryHelper = telemetryHelper;
   20     }
   21
   22     // Use lazy-loading to create repositories only when they are needed
   23     public IUserRepository Users => _users ??= new UserRepository(_connection, _telemetryHelper);
   24     public IOrderRepository Orders => _orders ??= new OrderRepository(_connection, _telemetryHelper);
   25
   26     public async Task<int> CommitAsync()
   27     {
   28         try
   29         {
   30             await _transaction.CommitAsync();
   31             _committed = true;
   32             return 1; // Or return number of affected rows if you track it
   33         }
   34         catch (Exception)
   35         {
   36             await _transaction.RollbackAsync();
   37             throw;
   38         }
   39     }
   40
   41     public async ValueTask DisposeAsync()
   42     {
   43         // If the transaction was not committed, it will be rolled back upon disposal
   44         if (!_committed)
   45         {
   46             await _transaction.RollbackAsync();
   47         }
   48         await _transaction.DisposeAsync();
   49         await _connection.DisposeAsync();
   50     }
   51 }
//////////
docker run --name sql_2017 -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=1Secure*Password1" -e
     "MSSQL_PID=Enterprise" -p 1433:1433 -v "C:\DbFolder:/var/opt/mssql/data" -d
     mcr.microsoft.com/mssql/server:2017-latest

npm install -g @github/copilot   
1. Azure Container Apps (ACA)

  This is often the recommended and best-fit option for most new containerized functions.

   * What it is: A serverless container service specifically designed for running microservices. It's built on
     Kubernetes but hides all the complexity. It has first-class support for KEDA (Kubernetes Event-driven
     Autoscaling), which allows your function to scale from zero to many instances based on triggers like queue
     messages, event hub events, or HTTP traffic—just like a regular function.
   * When to use it:
       * For event-driven microservices where you want powerful, trigger-based autoscaling without managing a
         Kubernetes cluster.
       * When you want a simple, serverless experience for your containers.
       * It's the modern "sweet spot" between the simplicity of PaaS and the power of Kubernetes.

  2. Azure Functions Premium Plan

   * What it is: A hosting plan dedicated to Azure Functions that fully supports running custom container
     images. It's a "Functions-native" experience.
   * When to use it:
       * When you want the benefits of a custom container but prefer to stay within the familiar Azure Functions
         management and deployment ecosystem.
       * When you need features of the Premium plan, such as VNet integration, no "cold starts" (with pre-warmed
         instances), and longer execution timeouts. The platform manages the scaling for you based on your
         function triggers.

  3. Azure Kubernetes Service (AKS)

   * What it is: Azure's full-featured, managed Kubernetes service. It gives you maximum power, control, and
     flexibility over your container orchestration.
   * When to use it:
       * When your organization already uses AKS for other microservices and you want to consolidate all your
         workloads on a single platform.
       * When you need advanced Kubernetes features like a service mesh (e.g., Istio, Linkerd), custom
         networking policies, or very specific node configurations.
       * Note: This option comes with the highest operational complexity. You are responsible for managing the
         cluster, networking, ingress controllers, and the KEDA installation to enable event-driven scaling for
         your function.

  4. Azure App Service (Web App for Containers)

   * What it is: Azure's flagship PaaS for hosting web applications can also run container images. You deploy
     your container to an App Service Plan.
   * When to use it:
       * If you are already heavily invested in the App Service platform and are comfortable with its scaling
         model (based on the CPU/memory of the plan, not function triggers).
       * For simple scenarios or when you want to run your function alongside a traditional web application in
         the same App Service Plan.

The two primary mechanisms for inter-workflow communication are:
   1. Starting workflows from within another workflow.
   2. Using a general-purpose eventing system.

  Here are the common patterns and how to implement them.

  ---

  1. Parent-Child Workflows

  This is a common pattern where a "parent" workflow needs to launch and delegate a piece of work to a "child" workflow.

   * How it Works: You use the built-in StartWorkflow primitive. The parent workflow can pass initial data to the child. By default, this is a
     "fire and forget" operation—the parent starts the child and immediately moves to its next step.

   * Waiting for the Child: To make the parent wait for the child to finish, you must combine StartWorkflow with the event system. The child
     workflow must publish a "completion" event as its final step, and the parent must use a WaitFor step to listen for it.

   * Example:

      Child Workflow (`ProcessItemWorkflow.cs`)
      This workflow does some work and then publishes an event to notify its parent that it's done.

    1     public class ProcessItemData
    2     {
    3         public string ItemId { get; set; }
    4         public string ParentWorkflowId { get; set; } // So we know who to notify
    5         public string Result { get; set; }
    6     }
    7
    8     // ... in the workflow definition ...
    9     builder
   10         .StartWith<DoSomeWork>()
   11             .Output(data => data.Result, step => step.Output)
   12         .Then(context =>
   13         {
   14             // Publish a completion event
   15             var host = context.Host;
   16             var data = (ProcessItemData)context.Workflow.Data;
   17             host.PublishEvent("ChildCompleted", data.ParentWorkflowId, data.Result);
   18         });

      Parent Workflow (`MainWorkflow.cs`)
      This workflow starts the child and waits for its completion event.

    1     // ... in the workflow definition ...
    2     .Then<StartWorkflow<ProcessItemData>>() // Generic version is clean
    3         .Input(step => step.WorkflowId, "ProcessItemWorkflow")
    4         .Input(step => step.Data,  (data, context) => new ProcessItemData
    5         {
    6             ItemId = "item-123",
    7             ParentWorkflowId = context.Workflow.Id // Pass our own ID to the child
    8         })
    9     .WaitFor("ChildCompleted", context => context.Workflow.Id) // Wait for an event keyed to our ID
   10         .Output(data => data.ResultFromChild, step => step.EventData)
   11     .Then<UseChildResult>();

  ---

  2. Fan-Out / Fan-In (Parallel Processing)

  This is a more advanced version of the parent-child pattern where a parent starts multiple child workflows to run in parallel and then
  waits for all of them to complete before proceeding.

   * How it Works:
       1. Fan-Out: The parent uses a ForEach step to loop over a collection of items. Inside the loop, it uses StartWorkflow for each item.
       2. Fan-In: The parent needs to wait until all children have published their completion event. This is typically done by using a While
          loop that waits for one event at a time and increments a counter until the count of completed children matches the number of jobs
          that were started.

   * Example:

    1     // Parent Data
    2     public class ParentData
    3     {
    4         public List<string> Items { get; set; }
    5         public int CompletedChildren { get; set; } = 0;
    6     }
    7
    8     // Parent Workflow Definition
    9     .ForEach(data => data.Items)
   10         .Do(x => x
   11             .Then<StartWorkflow<ProcessItemData>>()
   12                 .Input(step => step.WorkflowId, "ProcessItemWorkflow")
   13                 .Input(step => step.Data, (data, context) => new ProcessItemData
   14                 {
   15                     ItemId = context.Item,
   16                     ParentWorkflowId = context.Workflow.Id
   17                 })
   18         )
   19     // Fan-In part: Loop until all children are done
   20     .While(data => data.CompletedChildren < data.Items.Count)
   21         .Do(x => x
   22             .WaitFor("ChildCompleted", context => context.Workflow.Id)
   23             .Then(data => data.CompletedChildren++) // Increment counter on each event
   24         )
   25     .Then<AggregateAllResults>();

  ---

  3. Decoupled Communication via Events

  Workflows don't need a parent-child relationship to communicate. Any workflow can publish an event, and any other workflow can consume it.
  This allows you to build a "choreography" of independent microservices.

   * How it Works: One workflow uses IWorkflowHost.PublishEvent() to announce that something has happened. Other workflows use WaitFor to
     listen for these announcements and trigger their own processes. The workflows do not need to know about each other's existence; they only
     need to agree on the event name and key structure.

   * Use Case:
       * Workflow A (`UserRegistration`): When a new user signs up, it finishes by publishing an event: host.PublishEvent("UserSignedUp",
         user.Id, user.Email);
       * Workflow B (`OnboardingEmails`): This workflow is designed with a StartWith that is a WaitFor step, or has a WaitFor early on. It
         listens for the UserSignedUp event and, upon receiving it, begins a week-long email onboarding sequence.
       * Workflow C (`ProvisionResources`): A third workflow could also be listening for UserSignedUp to start provisioning account resources
         for the new user.

  This event-based approach is extremely powerful for building scalable and resilient systems where different business processes can react
  to events independently.

 1 .Then<StartWorkflow>() // 1. Place the built-in "Start a Workflow" step into our process.
    2
    3     // --- Now, we configure the step using .Input() ---
    4
    5     // 2. Set the 'WorkflowId' property on the StartWorkflow step.
    6     //    This tells the step WHICH workflow definition to launch.
    7     .Input(step => step.WorkflowId, "ProcessItemWorkflow")
    8
    9     // 3. (Optional) Set the 'Version' property to be specific.
   10     .Input(step => step.Version, 1)
   11
   12     // 4. Set the 'Data' property. This is the initial data object
   13     //    that will be passed to the new child workflow when it starts.
   14     .Input(step => step.Data, (data, context) => new ProcessItemData
   15     {
   16         ItemId = "item-123",
   17         ParentWorkflowId = context.Workflow.Id
   18     });

  The Execution Flow

  When your parent workflow reaches this point, here’s what the engine does behind the scenes:

   1. It sees it needs to execute a StartWorkflow step.
   2. It creates an instance of the WorkflowCore.Primitives.StartWorkflow class.
   3. It looks at your .Input() mappings and populates the properties on that instance. It sets instance.WorkflowId = "ProcessItemWorkflow",
      instance.Version = 1, etc.
   4. It then calls the Run() method on the StartWorkflow instance.
   5. Inside its Run() method, the StartWorkflow step takes the properties it was given and calls the main IWorkflowHost.StartWorkflow(...)
      service, effectively executing host.StartWorkflow("ProcessItemWorkflow", 1, new ProcessItemData(...)).

  So, you specify which child workflow to start by setting the WorkflowId property on the StartWorkflow primitive via the .Input() method.

__fullyQualifiedNamespace

 "extensions": {
        "serviceBus": {
          "transportType": "amqpWebSockets"
        }
      }

docker run --name sql_2017 -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=1Secure*Password1" -e "MSSQL_PID=Enterprise" -p 1433:1433 -d mcr.microsoft.com/mssql/server:2017-latest


CREATE TABLE [dbo].[UserTasks](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[User] [nvarchar](100) NOT NULL,
	[WorkflowId] [nvarchar](100) NOT NULL,
	[Approved] [bit] NOT NULL,
	[ManagerNotified] [bit] NOT NULL,
 CONSTRAINT [PK_UserTasks] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

---
  71
    72 // --- 3. The Main Workflow Definition ---
    73
    74 public class ComplexWorkflow : IWorkflow<ComplexWorkflowData>
    75 {
    76     public string Id => "ComplexWorkflow";
    77     public int Version => 1;
    78
    79     public void Build(IWorkflowBuilder<ComplexWorkflowData> builder)
    80     {
    81         builder
    82             .StartWith<Step1_Start>()
    83             // This is the main loop that allows us to "re-enter" Step 2
    84             .While(data => data.ShouldLoopOnActivity)
    85                 .Do(activityLoop => activityLoop
    86                     .Then<LogMessage>()
    87                         .Input(step => step.Message, "--> Step 2: Waiting for activity worker...")
    88                     // Define the external activity that needs to be processed
    89                     .Activity("do-work", data => data.WorkflowInstanceId)
    90                         .Output(data => data.ActivityResult, step => step.Result)
    91
    92                     // Check the result from the activity
    93                     .If(data => data.ActivityResult == true)
    94                         .Do(successPath => successPath
    95                             .Then<LogMessage>()
    96                                 .Input(step => step.Message, "--> Activity returned TRUE.
       Proceeding to user task.")
    97                             // This is the inner loop that allows the user to "restart" the task
    98                             .While(data => data.ShouldLoopOnUserTask)
    99                                 .Do(userTaskLoop => userTaskLoop
   100                                     .Then<LogMessage>()
   101                                         .Input(step => step.Message, "--> Step 3: Waiting for user
       decision...")
   102                                     .UserTask("Please review the task.", data => "some-user")
   103                                         .WithOption("approve", "Approve")
   104                                         .WithOption("disapprove", "Disapprove")
   105                                         .WithOption("restart", "Restart Task")
   106                                         .WithOption("rework", "Rework (Go to Step 2)")
   107                                         .Output(data => data.UserTaskChoice, step => step.Outcome)
   108                                 )
   109                             // Use a Switch to handle the user's choice
   110                             .Switch(data => data.UserTaskChoice)
   111                                 .Case("approve",
   112                                     // If approved, set both loop flags to false to exit
       completely
   113                                     new WorkflowBuilder<ComplexWorkflowData>(builder.Definition)
   114                                         .Then<LogMessage>()
   115                                             .Input(step => step.Message, "User chose: APPROVE")
   116                                         .Then<SetLoopFlags>()
   117                                             .Input(step => step.LoopActivity, false)
   118                                             .Input(step => step.LoopUserTask, false)
   119                                 )
   120                                 .Case("disapprove",
   121                                     // If disapproved, terminate the workflow
   122                                     new WorkflowBuilder<ComplexWorkflowData>(builder.Definition)
   123                                         .Then<LogMessage>()
   124                                             .Input(step => step.Message, "User chose: DISAPPROVE.
       Terminating.")
   125                                         .Then<TerminateWorkflow>()
   126                                 )
   127                                 .Case("restart",
   128                                     // If restart, keep the inner loop flag true to repeat the
       user task
   129                                     new WorkflowBuilder<ComplexWorkflow_Data>(builder.Definition)
   130                                         .Then<LogMessage>()
   131                                             .Input(step => step.Message, "User chose: RESTART.
       Presenting user task again.")
   132                                         .Then<SetLoopFlags>()
   133                                             .Input(step => step.LoopActivity, false)
   134                                             .Input(step => step.LoopUserTask, true)
   135                                 )
   136                                 .Case("rework",
   137                                     // If rework, exit the inner loop but keep the outer loop flag
       true
   138                                     new WorkflowBuilder<ComplexWorkflowData>(builder.Definition)
   139                                         .Then<LogMessage>()
   140                                             .Input(step => step.Message, "User chose: REWORK.
       Returning to activity step.")
   141                                         .Then<SetLoopFlags>()
   142                                             .Input(step => step.LoopActivity, true)
   143                                             .Input(step => step.LoopUserTask, false)
   144                                 )
   145                         )
   146                     .Else()
   147                         .Do(failurePath => failurePath
   148                             .Then<LogMessage>()
   149                                 .Input(step => step.Message, "--> Activity returned FALSE.
       Terminating.")
   150                             .Then<TerminateWorkflow>()
   151                         )
   152                 )
   153             .Then<Step4_Approved>()
   154             .Then<LogMessage>()
   155                 .Input(step => step.Message, "--> Step 5: Workflow finished.");
   156     }
   157 }

builder
    4         .StartWith<Step1_Start>()
    5         .While(data => data.ShouldLoopOnActivity)
    6             .Do(activityLoop => activityLoop
    7                 .Then<LogMessage>()
    8                     .Input(step => step.Message, "--> Step 2: Waiting for activity worker...")
    9                 .Activity("do-work", data => data.WorkflowInstanceId)
   10                     .Output(data => data.ActivityResult, step => step.Result)
   11                 .If(data => data.ActivityResult == true)
   12                     .Do(successPath => successPath
   13                         .Then<LogMessage>()
   14                             .Input(step => step.Message, "--> Activity returned TRUE. Proceeding to user task.")
   15                         .While(data => data.ShouldLoopOnUserTask)
   16                             .Do(userTaskLoop => userTaskLoop
   17                                 .Then<LogMessage>()
   18                                     .Input(step => step.Message, "--> Step 3: Waiting for user decision...")
   19                                 .UserTask("Please review the task.", data => "some-user")
   20                                     .WithOption("approve", "Approve")
   21                                     .WithOption("disapprove", "Disapprove")
   22                                     .WithOption("restart", "Restart Task")
   23                                     .WithOption("rework", "Rework (Go to Step 2)")
   24                                     .Output(data => data.UserTaskChoice, step => step.Outcome)
   25                             )
   26                         //
   27                         // --- THIS IS THE CORRECTED SWITCH BLOCK ---
   28                         //
   29                         .Switch(data => data.UserTaskChoice)
   30                             .Case("approve", approveBranch => approveBranch
   31                                 .Then<LogMessage>()
   32                                     .Input(step => step.Message, "User chose: APPROVE")
   33                                 .Then<SetLoopFlags>()
   34                                     .Input(step => step.LoopActivity, false)
   35                                     .Input(step => step.LoopUserTask, false)
   36                             )
   37                             .Case("disapprove", disapproveBranch => disapproveBranch
   38                                 .Then<LogMessage>()
   39                                     .Input(step => step.Message, "User chose: DISAPPROVE. Terminating.")
   40                                 .Then<TerminateWorkflow>()
   41                             )
   42                             .Case("restart", restartBranch => restartBranch
   43                                 .Then<LogMessage>()
   44                                     .Input(step => step.Message, "User chose: RESTART. Presenting user task again.")
   45                                 .Then<SetLoopFlags>()
   46                                     .Input(step => step.LoopActivity, false)
   47                                     .Input(step => step.LoopUserTask, true)
   48                             )
   49                             .Case("rework", reworkBranch => reworkBranch
   50                                 .Then<LogMessage>()
   51                                     .Input(step => step.Message, "User chose: REWORK. Returning to activity step.")
   52                                 .Then<SetLoopFlags>()
   53                                     .Input(step => step.LoopActivity, true)
   54                                     .Input(step => step.LoopUserTask, false)
   55                             )
   56                     )
   57                 .Else()
   58                     .Do(failurePath => failurePath
   59                         .Then<LogMessage>()
   60                             .Input(step => step.Message, "--> Activity returned FALSE. Terminating.")
   61                         .Then<TerminateWorkflow>()
   62                     )
   63             )
   64         .Then<Step4_Approved>()
   65         .Then<LogMessage>()
   66             .Input(step => step.Message, "--> Step 5: Workflow finished.");

*********************
builder
   28             .StartWith<Step1_Start>()
   29             .While(data => data.ShouldLoopOnActivity)
   30                 .Do(activityLoop => activityLoop
   31                     .Then<LogMessage>()
   32                         .Input(step => step.Message, "--> Step 2: Waiting for activity worker...")
   33                     .Activity("do-work", data => data.WorkflowInstanceId)
   34                         .Output(data => data.ActivityResult, step => step.Result)
   35
   36                     .If(data => data.ActivityResult == true)
   37                         .Do(successPath => successPath
   38                             .Then<LogMessage>()
   39                                 .Input(step => step.Message, "--> Activity returned TRUE. Proceeding to user task.")
   40                             .While(data => data.ShouldLoopOnUserTask)
   41                                 .Do(userTaskLoop => userTaskLoop
   42                                     .Then<LogMessage>()
   43                                         .Input(step => step.Message, "--> Step 3: Waiting for user decision...")
   44                                     //
   45                                     // --- THIS IS THE CORRECTED USER TASK SYNTAX ---
   46                                     //
   47                                     .UserTask("Please review the task.", data => "some-user")
   48                                         .WithOption("approve", "Approve").Do(approveBranch => approveBranch
   49                                             .Then<LogMessage>().Input(step => step.Message, "User chose: APPROVE")
   50                                             // Exit both loops and proceed to Step 4
   51                                             .Then<SetLoopFlags>()
   52                                                 .Input(step => step.LoopActivity, false)
   53                                                 .Input(step => step.LoopUserTask, false)
   54                                         )
   55                                         .WithOption("disapprove", "Disapprove").Do(disapproveBranch => disapproveBranch
   56                                             .Then<LogMessage>().Input(step => step.Message, "User chose: DISAPPROVE. Terminating.")
   57                                             .Then<TerminateWorkflow>()
   58                                         )
   59                                         .WithOption("restart", "Restart Task").Do(restartBranch => restartBranch
   60                                             .Then<LogMessage>().Input(step => step.Message, "User chose: RESTART. Presenting user task again.")
   61                                             // Stay in the user task loop
   62                                             .Then<SetLoopFlags>()
   63                                                 .Input(step => step.LoopActivity, false)
   64                                                 .Input(step => step.LoopUserTask, true)
   65                                         )
   66                                         .WithOption("rework", "Rework (Go to Step 2)").Do(reworkBranch => reworkBranch
   67                                             .Then<LogMessage>().Input(step => step.Message, "User chose: REWORK. Returning to activity step.")
   68                                             // Exit the user task loop, but stay in the main activity loop
   69                                             .Then<SetLoopFlags>()
   70                                                 .Input(step => step.LoopActivity, true)
   71                                                 .Input(step => step.LoopUserTask, false)
   72                                         )
   73                                 )
   74                         )
   75                     .Else()
   76                         .Do(failurePath => failurePath
   77                             .Then<LogMessage>()
   78                                 .Input(step => step.Message, "--> Activity returned FALSE. Terminating.")
   79                             .Then<TerminateWorkflow>()
   80                         )
   81                 )
   82             .Then<Step4_Approved>()
   83             .Then<LogMessage>()
   84                 .Input(step => step.Message, "--> Step 5: Workflow finished.");
222222222222222222

  1 public void Build(IWorkflowBuilder<ComplexWorkflowData> builder)
    2 {
    3     // --- Step 1: Define the logic for each user choice as a separate Action ---
    4     // (This part remains the same as the previous version)
    5
    6     Action<IWorkflowBuilder<ComplexWorkflowData>> approveAction = branch => branch
    7         .Then<LogMessage>().Input(step => step.Message, "User chose: APPROVE")
    8         .Then<SetLoopFlags>().Input(step => step.LoopActivity, false).Input(step => step.LoopUserTask, false);
    9
   10     Action<IWorkflowBuilder<ComplexWorkflowData>> disapproveAction = branch => branch
   11         .Then<LogMessage>().Input(step => step.Message, "User chose: DISAPPROVE. Terminating.")
   12         .Then<TerminateWorkflow>();
   13
   14     Action<IWorkflowBuilder<ComplexWorkflowData>> restartAction = branch => branch
   15         .Then<LogMessage>().Input(step => step.Message, "User chose: RESTART. Presenting user task again.")
   16         .Then<SetLoopFlags>().Input(step => step.LoopActivity, false).Input(step => step.LoopUserTask, true);
   17
   18     Action<IWorkflowBuilder<ComplexWorkflowData>> reworkAction = branch => branch
   19         .Then<LogMessage>().Input(step => step.Message, "User chose: REWORK. Returning to activity step.")
   20         .Then<SetLoopFlags>().Input(step => step.LoopActivity, true).Input(step => step.LoopUserTask, false);
   21
   22     // --- Step 2: Define the logic for the two main paths ---
   23     // (This part also remains the same)
   24
   25     Action<IWorkflowBuilder<ComplexWorkflowData>> activitySuccessPath = successPath =>
   26     {
   27         successPath
   28             .Then<LogMessage>().Input(step => step.Message, "--> Activity returned TRUE. Proceeding to user task.")
   29             .While(data => data.ShouldLoopOnUserTask)
   30                 .Do(userTaskLoop => userTaskLoop
   31                     .Then<LogMessage>().Input(step => step.Message, "--> Step 3: Waiting for user decision...")
   32                     .UserTask("Please review the task.", data => "some-user")
   33                         .WithOption("approve", "Approve").Do(approveAction)
   34                         .WithOption("disapprove", "Disapprove").Do(disapproveAction)
   35                         .WithOption("restart", "Restart Task").Do(restartAction)
   36                         .WithOption("rework", "Rework (Go to Step 2)").Do(reworkAction)
   37                 );
   38     };
   39
   40     Action<IWorkflowBuilder<ComplexWorkflowData>> activityFailurePath = failurePath =>
   41     {
   42         failurePath
   43             .Then<LogMessage>().Input(step => step.Message, "--> Activity returned FALSE. Terminating.")
   44             .Then<TerminateWorkflow>();
   45     };
   46
   47
   48     // --- Step 3: Assemble the final workflow ---
   49     // (This is the part that has been changed to remove .Else())
   50
   51     builder
   52         .StartWith<Step1_Start>()
   53         .While(data => data.ShouldLoopOnActivity)
   54             .Do(activityLoop => activityLoop
   55                 .Then<LogMessage>().Input(step => step.Message, "--> Step 2: Waiting for activity worker...")
   56                 .Activity("do-work", data => data.WorkflowInstanceId)
   57                     .Output(data => data.ActivityResult, step => step.Result)
   58
   59                 //
   60                 // --- THIS IS THE REFACTORED IF/IF BLOCK ---
   61                 //
   62                 // First, check for the success case
   63                 .If(data => data.ActivityResult == true)
   64                     .Then(activitySuccessPath)
   65
   66                 // Second, check for the failure case
   67                 .If(data => data.ActivityResult == false)
   68                     .Then(activityFailurePath)
   69             )
   70         .Then<Step4_Approved>()
   71         .Then<LogMessage>().Input(step => step.Message, "--> Step 5: Workflow finished.");
   72 }
--- PARALLEL --------
 public void Build(IWorkflowBuilder<ParallelData> builder)
    2 {
    3     builder
    4         .StartWith<Step0_Start>()
    5         // --- Outer Parallel Block ---
    6         .Parallel()
    7             // --- Branch A: The Main Logic (Steps 1, 2, and 4) ---
    8             .Do(mainBranch => mainBranch
    9                 // --- Inner Parallel Block ---
   10                 .Parallel()
   11                     .Do(branch1 => branch1
   12                         .StartWith<Step1_Parallel>()
   13                             .Output(data => data.ResultFromStep1, step => step.MyOutput)
   14                     )
   15                     .Do(branch2 => branch2
   16                         .StartWith<Step2_Parallel>()
   17                             .Output(data => data.ResultFromStep2, step => step.MyOutput)
   18                     )
   19                 .Join() // Waits for ONLY Step 1 and Step 2 to finish.
   20
   21                 // This step runs after the inner join is satisfied.
   22                 .Then<Step4_Join>()
   23                     .Input(step => step.Input1, data => data.ResultFromStep1)
   24                     .Input(step => step.Input2, data => data.ResultFromStep2)
   25                     .Output(data => data.FinalResultFromStep4, step => step.MyOutput)
   26             )
   27
   28             // --- Branch B: The Independent Logic (Step 3) ---
   29             .Do(independentBranch => independentBranch
   30                 .StartWith<Step3_IndependentParallel>()
   31             )
   32         //
   33         // ---> The final .Join() is here <---
   34         // It waits for both Branch A and Branch B to be completely finished.
   35         //
   36         .Join()
   37         //
   38         // ---> The new final step is added here <---
   39         // This is guaranteed to run only after the Join is satisfied.
   40         //
   41         .Then<Step5_Finish>();

