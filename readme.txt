 public class ServiceBusMessage
 {
     /// <summary>
     /// Time set by the sender
     /// </summary>
     public DateTime Date { get; set; }

     /// <summary>
     /// Unique identifier which can correlate the producer and the consumer. Format is agreed by them.
     /// </summary>
     public string Reference { get; set; }

     /// <summary>
     /// The name of the sending system.
     /// </summary>
     public string Sender { get; set; }

     /// <summary>
     /// Name of the operation
     /// </summary>
     public string Event { get; set; }

     /// <summary>
     /// Current status of the operation.
     /// </summary>
     public string Status { get; set; }
 }

 public class ServiceBusMessage<T> : ServiceBusMessage
 {
     /// <summary>
     /// The paylod the sender decided to send. Json format with PascalCase properties.
     /// </summary>
     public T Payload { get; set; }
 }

 var deserializedMessage = JsonSerializer.Deserialize<ServiceBusMessage<List<KeyValue>>>(servicebusreceivedmessage.Body().ToString)
