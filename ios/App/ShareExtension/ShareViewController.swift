import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    private let statusLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .large)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.1, green: 0.1, blue: 0.1, alpha: 1.0)

        spinner.color = UIColor(red: 1.0, green: 0.898, blue: 0.0, alpha: 1.0) // #FFE500
        spinner.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(spinner)

        statusLabel.textColor = .white
        statusLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        statusLabel.textAlignment = .center
        statusLabel.text = "Sending to ONE70 CRM..."
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -20),
            statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            statusLabel.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 16),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
        ])

        spinner.startAnimating()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        handleSharedContent()
    }

    private func handleSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            showResult(success: false, message: "Nothing to share")
            return
        }

        var sharedText = ""
        let group = DispatchGroup()

        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            for provider in attachments {
                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { (data, error) in
                        if let text = data as? String {
                            sharedText += text + "\n"
                        }
                        group.leave()
                    }
                }
                else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { (data, error) in
                        if let url = data as? URL {
                            sharedText += url.absoluteString + "\n"
                        }
                        group.leave()
                    }
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            let trimmed = sharedText.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else {
                self?.showResult(success: false, message: "No text found")
                return
            }
            self?.sendToAPI(text: trimmed)
        }
    }

    private func sendToAPI(text: String) {
        let urlString = "https://crm.one70group.com/api/share/receive"
        guard let url = URL(string: urlString) else {
            showResult(success: false, message: "Invalid URL")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        let payload: [String: Any] = [
            "text": String(text.prefix(5000)),
            "secret": "one70-share-2024"
        ]

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        } catch {
            showResult(success: false, message: "Failed to encode")
            return
        }

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    self?.showResult(success: false, message: "Network error")
                    return
                }

                let httpResponse = response as? HTTPURLResponse
                if httpResponse?.statusCode == 200 {
                    self?.showResult(success: true, message: "Sent to ONE70 CRM!")
                } else {
                    self?.showResult(success: false, message: "Failed to send")
                }
            }
        }.resume()
    }

    private func showResult(success: Bool, message: String) {
        spinner.stopAnimating()
        statusLabel.text = message
        statusLabel.textColor = success ? UIColor(red: 0.4, green: 0.9, blue: 0.4, alpha: 1.0) : UIColor(red: 1.0, green: 0.4, blue: 0.4, alpha: 1.0)

        DispatchQueue.main.asyncAfter(deadline: .now() + (success ? 1.0 : 2.0)) { [weak self] in
            self?.close()
        }
    }

    private func close() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
