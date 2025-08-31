 var testPayload = new List<KeyValue>
   15     {
   16         new KeyValue { Key = "ID", Value = "12345" }
   17     };
   18
   19     // Create the full message envelope object
   20     var messageEnvelope = new ServiceBusMessage<List<KeyValue>>
   21     {
   22         Date = DateTime.UtcNow,
   23         Reference = "test-ref",
   24         Sender = "my-test",
   25         Event = "TestEvent",
   26         Status = "Complete",
   27         Payload = testPayload // Set the payload here
   28     };
